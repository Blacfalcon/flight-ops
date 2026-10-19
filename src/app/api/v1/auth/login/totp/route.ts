import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, clientIp, publicRoute } from '@/lib/api';
import { totpLoginSchema } from '@/lib/validators';
import { verifyMfaChallenge } from '@/lib/auth/jwt';
import { checkTotp, openSecret } from '@/lib/auth/totp';
import { createSession, writeAuthCookies, writeMfaDayCookie } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

export const POST = publicRoute(totpLoginSchema, async ({ challenge, code }, req) => {
  const userId = await verifyMfaChallenge(challenge);
  if (!userId) throw new ApiError(401, 'expired', 'That sign-in attempt expired. Start again.');
  const limit = rateLimit(`totp:${userId}:${clientIp(req)}`, 6, 5 * 60_000);
  if (!limit.ok) throw new ApiError(429, 'rate_limited', 'Too many codes tried. Start the sign-in again in a few minutes.');

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.accountStatus !== 'ACTIVE' || !user.totpEnabled || !user.totpSecretEnc) throw new ApiError(401, 'expired', 'Start the sign-in again.');
  if (!checkTotp(code, openSecret(user.totpSecretEnc))) {
    await audit(user.id, 'auth.totpFailed', 'user', user.id);
    throw new ApiError(401, 'bad_code', 'That code is not right. Check the time on your phone and try the newest code.');
  }
  const s = await createSession(user.id);
  await audit(user.id, 'auth.login', 'user', user.id, { after: { mfa: true } });
  const res = NextResponse.json({ ok: true });
  writeAuthCookies(res.cookies, s.accessToken, s.refreshToken);
  await writeMfaDayCookie(res.cookies, user.id);
  return res;
});
