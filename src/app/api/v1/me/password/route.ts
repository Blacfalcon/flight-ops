import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, invalid, route } from '@/lib/api';
import { changePasswordSchema } from '@/lib/validators';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password';
import { createSession, revokeAllSessions, writeAuthCookies } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

export const POST = route({ schema: changePasswordSchema }, async ({ auth, body }) => {
  if (!(await verifyPassword(auth.user.passwordHash, body.current))) throw new ApiError(400, 'bad_password', 'Your current password is not right.', { current: 'Not right.' });
  const weak = passwordProblem(body.next);
  if (weak) throw invalid(weak, { next: weak });
  await db.user.update({ where: { id: auth.user.id }, data: { passwordHash: await hashPassword(body.next) } });
  // Sign out everywhere else, keep this device signed in
  await revokeAllSessions(auth.user.id);
  const s = await createSession(auth.user.id);
  await audit(auth.user.id, 'auth.passwordChanged', 'user', auth.user.id);
  const res = NextResponse.json({ ok: true });
  writeAuthCookies(res.cookies, s.accessToken, s.refreshToken);
  return res;
});
