import { db } from '@/lib/db';
import { ApiError, clientIp, invalid, publicRoute } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { resetSchema } from '@/lib/validators';
import { hashToken } from '@/lib/crypto';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { revokeAllSessions } from '@/lib/auth/session';
import { audit } from '@/lib/audit';

export const POST = publicRoute(resetSchema, async ({ token, password }, req) => {
  const limit = rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000);
  if (!limit.ok) throw new ApiError(429, 'rate_limited', `Too many attempts. Try again in ${limit.retryAfterSec} seconds.`);
  const weak = passwordProblem(password);
  if (weak) throw invalid(weak, { password: weak });
  const row = await db.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.purpose !== 'RESET_PASSWORD' || row.usedAt || row.expiresAt < new Date()) {
    throw new ApiError(400, 'invalid_token', 'This reset link is invalid or has expired. Ask for a new one.');
  }
  await db.$transaction([
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } }),
  ]);
  await revokeAllSessions(row.userId);
  await audit(row.userId, 'auth.passwordReset', 'user', row.userId);
  return { ok: true };
});
