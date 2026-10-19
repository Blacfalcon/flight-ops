import { Prisma } from '@prisma/client';
import { db } from './db';

// Shared by the web app and the worker, so no 'server-only' and no static next/headers import.

type Tx = Prisma.TransactionClient | typeof db;

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(
    JSON.stringify(v, (key, val) => {
      if (key === 'passwordHash' || key === 'totpSecretEnc' || key === 'refreshTokenHash' || key === 'tokenHash') return '[hidden]';
      return typeof val === 'bigint' ? val.toString() : val;
    }),
  ) as Prisma.InputJsonValue;
}

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    return {
      ip: h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
    };
  } catch {
    return { ip: null, userAgent: null }; // outside a web request (worker)
  }
}

/** Append a line to the audit trail. Never throws: auditing must not break the action itself. */
export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  change: { before?: unknown; after?: unknown } = {},
  tx: Tx = db,
) {
  try {
    const meta = await requestMeta();
    await tx.auditLog.create({
      data: { actorId, action, entityType, entityId, before: toJson(change.before), after: toJson(change.after), ip: meta.ip, userAgent: meta.userAgent },
    });
  } catch (err) {
    console.error('audit failed', err);
  }
}
