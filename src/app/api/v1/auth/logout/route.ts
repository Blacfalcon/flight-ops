import { NextResponse } from 'next/server';
import { getAuth, clearAuthCookies, revokeSession } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

export async function POST() {
  const auth = await getAuth();
  if (auth) {
    await revokeSession(auth.sessionId);
    await audit(auth.user.id, 'auth.logout', 'user', auth.user.id);
  }
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res.cookies);
  return res;
}
