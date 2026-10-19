import { db } from '@/lib/db';
import { ApiError, clientIp, publicRoute } from '@/lib/api';
import { forgotSchema } from '@/lib/validators';
import { hashToken, randomToken } from '@/lib/crypto';
import { sendPasswordResetEmail } from '@/lib/mail';
import { rateLimit } from '@/lib/rate-limit';

// Always answers the same way, so it cannot be used to find out who has an account.
export const POST = publicRoute(forgotSchema, async ({ email }, req) => {
  const limit = rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000);
  if (!limit.ok) throw new ApiError(429, 'rate_limited', `Too many attempts. Try again in ${limit.retryAfterSec} seconds.`);
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.accountStatus === 'ACTIVE') {
    const token = randomToken();
    await db.authToken.create({ data: { userId: user.id, purpose: 'RESET_PASSWORD', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3_600_000) } });
    try {
      await sendPasswordResetEmail(user.email, token);
    } catch (err) {
      console.error('reset email failed', err);
    }
  }
  return { ok: true };
});
