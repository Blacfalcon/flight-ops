import { db } from '@/lib/db';
import { ApiError, clientIp, invalid, publicRoute } from '@/lib/api';
import { registerSchema } from '@/lib/validators';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { hashToken, randomToken } from '@/lib/crypto';
import { sendVerificationEmail } from '@/lib/mail';
import { rateLimit } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';
import { decodeImage } from '@/lib/images';

export const POST = publicRoute(registerSchema, async (body, req) => {
  const limit = rateLimit(`register:${clientIp(req)}`, 5, 15 * 60_000);
  if (!limit.ok) throw new ApiError(429, 'rate_limited', `Too many attempts. Try again in ${limit.retryAfterSec} seconds.`);

  const weak = passwordProblem(body.password);
  if (weak) throw invalid(weak, { password: weak });

  const existing = await db.user.findFirst({ where: { OR: [{ email: body.email }, { nafNumber: body.nafNumber }] }, select: { email: true } });
  if (existing) {
    const field = existing.email === body.email ? 'email' : 'nafNumber';
    throw new ApiError(409, 'duplicate', 'An account with these details already exists.', { [field]: 'Already registered.' });
  }

  const { password, photo, accept, ...rest } = body;
  void accept; // checked by the schema; not stored
  const img = photo ? decodeImage(photo, 250_000, 'photo') : null;
  const user = await db.user.create({
    data: {
      ...rest,
      passwordHash: await hashPassword(password),
      accountStatus: 'PENDING_VERIFICATION',
      ...(img ? { photo: new Uint8Array(img.data), photoMime: img.mime, photoUpdatedAt: new Date() } : {}),
    },
    select: { id: true, email: true },
  });

  const token = randomToken();
  await db.authToken.create({ data: { userId: user.id, purpose: 'VERIFY_EMAIL', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 3_600_000) } });
  try {
    await sendVerificationEmail(user.email, token);
  } catch (err) {
    console.error('verification email failed', err);
  }
  await audit(user.id, 'user.register', 'user', user.id, { after: { ...rest, photo: !!img } });
  return { ok: true };
});
