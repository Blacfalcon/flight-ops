import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, clientIp, publicRoute } from '@/lib/api';
import { verifyPassword } from '@/lib/auth/password';
import { rateLimit } from '@/lib/rate-limit';
import { requestDeletion } from '@/lib/services/account-deletion';

const schema = z.object({
  identifier: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
  reason: z.string().trim().max(500).optional(),
});

// The public deletion page (required by Google Play): works without opening the app.
// The person proves it is their account with their password, the same as signing in.
export const POST = publicRoute(schema, async ({ identifier, password, reason }, req) => {
  const limit = rateLimit(`delete:${clientIp(req)}`, 5, 15 * 60_000);
  if (!limit.ok) throw new ApiError(429, 'rate_limited', `Too many attempts. Try again in ${limit.retryAfterSec} seconds.`);

  const id = identifier.trim();
  const user = await db.user.findFirst({ where: { OR: [{ email: id.toLowerCase() }, { nafNumber: id.toUpperCase() }] }, select: { id: true, passwordHash: true, email: true } });
  const generic = new ApiError(401, 'bad_credentials', 'The service number, email or password is not right.');
  if (!user || user.email.endsWith('@deleted.invalid')) throw generic;
  if (!(await verifyPassword(user.passwordHash, password))) throw generic;

  await requestDeletion(user.id, reason, 'web');
  return { ok: true };
});
