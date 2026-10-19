import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { Prisma } from '@prisma/client';
import { getAuth, type AuthContext } from './auth/session';
import type { Permission } from './rbac';
import { ApiError, forbidden, invalid } from './api-errors';

export { ApiError, notFound, forbidden, conflict, invalid } from './api-errors';

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, fields: err.fields ?? {} } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: { code: 'invalid', message: 'Some fields need attention.', fields } }, { status: 422 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? (err.meta?.target as string[]).join(', ') : 'value';
    return NextResponse.json({ error: { code: 'duplicate', message: `That ${target} is already in use.`, fields: {} } }, { status: 409 });
  }
  console.error(err);
  return NextResponse.json({ error: { code: 'server_error', message: 'Something went wrong. Try again.', fields: {} } }, { status: 500 });
}

type Ctx<S extends ZodTypeAny | undefined> = {
  req: NextRequest;
  auth: AuthContext;
  body: S extends ZodTypeAny ? z.infer<S> : undefined;
  params: Record<string, string>;
  query: URLSearchParams;
};

type Options<S extends ZodTypeAny | undefined> = {
  /** Any one of these permissions is enough */
  perm?: Permission | Permission[];
  schema?: S;
};

type RouteContext = { params: Promise<Record<string, string>> };

/** Wraps a route handler: sign-in check, permission check, body validation, error formatting. */
export function route<S extends ZodTypeAny | undefined = undefined>(
  opts: Options<S>,
  handler: (ctx: Ctx<S>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: RouteContext) => {
    try {
      const auth = await getAuth();
      if (!auth) throw new ApiError(401, 'unauthenticated', 'Please sign in again.');
      if (opts.perm) {
        const needed = Array.isArray(opts.perm) ? opts.perm : [opts.perm];
        if (!needed.some((p) => auth.perms.has(p))) throw forbidden();
      }
      let body: unknown = undefined;
      if (opts.schema) {
        const raw = await req.json().catch(() => {
          throw invalid('The request body is not valid JSON.');
        });
        body = opts.schema.parse(raw);
      }
      const params = context?.params ? await context.params : {};
      const result = await handler({ req, auth, body: body as Ctx<S>['body'], params, query: req.nextUrl.searchParams });
      if (result instanceof NextResponse || result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** For public endpoints (registration, sign-in): validation and error formatting only. */
export function publicRoute<S extends ZodTypeAny>(schema: S, handler: (body: z.infer<S>, req: NextRequest) => Promise<unknown>) {
  return async (req: NextRequest) => {
    try {
      const raw = await req.json().catch(() => {
        throw invalid('The request body is not valid JSON.');
      });
      const result = await handler(schema.parse(raw), req);
      if (result instanceof NextResponse || result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function paging(query: URLSearchParams) {
  const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.get('limit') ?? 50) || 50));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
