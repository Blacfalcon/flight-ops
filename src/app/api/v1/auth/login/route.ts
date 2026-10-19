import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, clientIp, publicRoute } from '@/lib/api';
import { loginSchema } from '@/lib/validators';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, writeAuthCookies } from '@/lib/auth/session';
import { MFA_DAY_COOKIE, signMfaChallenge, verifyMfaDay } from '@/lib/auth/jwt';
import { localDate } from '@/lib/time';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const MFA_APPOINTMENTS = new Set(['COMMANDER', 'GOO', 'ADMIN']);

export const POST = publicRoute(loginSchema, async ({ identifier, password }, req) => {
  const ip = clientIp(req);
  const limit = rateLimit(`login:${ip}`, 20, 15 * 60_000);
  if (!limit.ok) throw new ApiError(429, 'rate_limited', `Too many attempts. Try again in ${limit.retryAfterSec} seconds.`);

  const id = identifier.trim();
  const user = await db.user.findFirst({ where: { OR: [{ email: id.toLowerCase() }, { nafNumber: id.toUpperCase() }] } });
  const generic = new ApiError(401, 'bad_credentials', 'The Service number, email or password is not right.');
  if (!user) throw generic;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(423, 'locked', `Too many failed attempts. Try again after ${user.lockedUntil.toISOString().slice(11, 16)}Z.`);
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    const fails = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
    });
    await audit(user.id, 'auth.loginFailed', 'user', user.id);
    throw generic;
  }

  if (user.accountStatus === 'PENDING_VERIFICATION') throw new ApiError(403, 'unverified', 'Confirm your email first. Check your inbox for the link.');
  if (user.accountStatus === 'PENDING_ACTIVATION') throw new ApiError(403, 'pending', 'Your account is waiting for Admin to activate it.');
  if (user.accountStatus === 'SUSPENDED') throw new ApiError(403, 'suspended', 'This account is suspended. Contact Admin.');

  // Two-step code: asked on the first sign-in of the day on this device only
  const mfaDoneToday = user.totpEnabled && (await verifyMfaDay(req.cookies.get(MFA_DAY_COOKIE)?.value, user.id, localDate()));
  if (user.totpEnabled && !mfaDoneToday) {
    return { mfa: true, challenge: await signMfaChallenge(user.id) };
  }

  const s = await createSession(user.id);
  await audit(user.id, 'auth.login', 'user', user.id, mfaDoneToday ? { after: { mfa: 'earlier today on this device' } } : undefined);
  const res = NextResponse.json({ ok: true, mfaSetupRequired: MFA_APPOINTMENTS.has(user.appointment) });
  writeAuthCookies(res.cookies, s.accessToken, s.refreshToken);
  return res;
});
