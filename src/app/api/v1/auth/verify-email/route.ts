import { db } from '@/lib/db';
import { ApiError, publicRoute } from '@/lib/api';
import { tokenSchema } from '@/lib/validators';
import { hashToken } from '@/lib/crypto';
import { notify } from '@/lib/notify';
import { audit } from '@/lib/audit';

export const POST = publicRoute(tokenSchema, async ({ token }) => {
  const row = await db.authToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!row || row.purpose !== 'VERIFY_EMAIL' || row.usedAt || row.expiresAt < new Date()) {
    throw new ApiError(400, 'invalid_token', 'This link is invalid or has expired. Register again or ask Admin to resend it.');
  }
  await db.$transaction([
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.user.update({
      where: { id: row.userId },
      data: {
        emailVerifiedAt: new Date(),
        accountStatus: row.user.accountStatus === 'PENDING_VERIFICATION' ? 'PENDING_ACTIVATION' : row.user.accountStatus,
      },
    }),
  ]);
  const admins = await db.user.findMany({ where: { appointment: 'ADMIN', accountStatus: 'ACTIVE' }, select: { id: true } });
  await notify(admins.map((a) => a.id), { kind: 'user.awaitingActivation', title: 'A new account is awaiting activation', link: '/admin/users?status=PENDING_ACTIVATION', email: true });
  await audit(row.userId, 'user.verifyEmail', 'user', row.userId);
  return { ok: true };
});
