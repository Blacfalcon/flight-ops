import { NextResponse, type NextRequest } from 'next/server';
import { REFRESH_COOKIE } from '@/lib/auth/jwt';
import { clearAuthCookies, refreshSession, writeAuthCookies } from '@/lib/auth/session';

// POST: called by the app's fetch helper when an API call returns 401.
export async function POST(req: NextRequest) {
  const r = await refreshSession(req.cookies.get(REFRESH_COOKIE)?.value);
  if (!r) {
    const res = NextResponse.json({ error: { code: 'unauthenticated', message: 'Please sign in again.', fields: {} } }, { status: 401 });
    clearAuthCookies(res.cookies);
    return res;
  }
  const res = NextResponse.json({ ok: true });
  writeAuthCookies(res.cookies, r.accessToken, r.refreshToken);
  return res;
}

// GET: middleware sends page requests here when the access cookie has expired, then back to the page.
export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const r = await refreshSession(req.cookies.get(REFRESH_COOKIE)?.value);
  if (!r) {
    const res = NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(safeNext)}`, req.url));
    clearAuthCookies(res.cookies);
    return res;
  }
  const res = NextResponse.redirect(new URL(safeNext, req.url));
  writeAuthCookies(res.cookies, r.accessToken, r.refreshToken);
  return res;
}
