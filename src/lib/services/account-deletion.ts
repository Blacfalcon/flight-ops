import type { Prisma } from '@prisma/client';
import { randomToken } from '../crypto';
import { db } from '../db';
import { conflict, forbidden } from '../api-errors';
import { notify } from '../notify';
import { audit } from '../audit';

// Account deletion, as Google Play and the App Store require.
// A person asks (in the app, or on the public /delete-account page). Admin approves it on the
// Change requests page. The request uses the change-request list with field "accountDeletion".
//
// On approval the person's sign-in and contact details are deleted: email, phone, photo,
// password, two-step secret, sessions, phones registered for alerts and notifications. Rank,
// name and service number stay on the flights, approvals and reports they took part in, because those
// are unit records. The account is closed and can never sign in again.

export const DELETION_FIELD = 'accountDeletion';

type Tx = Prisma.TransactionClient;

export async function requestDeletion(userId: string, reason: string | undefined, via: 'app' | 'web') {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, appointment: true, accountStatus: true } });
  if (!user) throw forbidden('Account not found.');
  const open = await db.profileChangeRequest.findFirst({ where: { userId, field: DELETION_FIELD, status: 'PENDING' } });
  if (open) throw conflict('You have already asked for this account to be deleted. Admin will act on it.');
  if (user.appointment === 'ADMIN') {
    const otherAdmins = await db.user.count({ where: { appointment: 'ADMIN', accountStatus: 'ACTIVE', id: { not: userId } } });
    if (!otherAdmins) throw forbidden('You are the only Admin. Appoint another Admin before deleting your account.');
  }
  const row = await db.profileChangeRequest.create({
    data: { userId, field: DELETION_FIELD, oldValue: user.accountStatus, newValue: 'DELETED', reason: reason?.trim() || null },
  });
  const admins = await db.user.findMany({ where: { appointment: 'ADMIN', accountStatus: 'ACTIVE', id: { not: userId } }, select: { id: true } });
  await notify(admins.map((a) => a.id), { kind: 'changeRequest.new', title: 'An account deletion request is waiting', link: '/admin/requests', email: true });
  await audit(userId, 'user.requestDeletion', 'profile_change_request', row.id, { after: { via } });
  return row;
}

/** Deletes the person's sign-in and contact details and closes the account. Run inside the approval. */
export async function deleteAccountData(tx: Tx, userId: string) {
  await tx.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${userId}@deleted.invalid`,
      phone: '',
      photo: null,
      photoMime: null,
      photoUpdatedAt: null,
      passwordHash: `deleted:${randomToken()}`, // not a valid hash, so no password can ever match
      totpSecretEnc: null,
      totpEnabled: false,
      emailAlerts: 'NONE',
      accountStatus: 'SUSPENDED',
      failedLogins: 0,
      lockedUntil: null,
    },
  });
  await tx.session.deleteMany({ where: { userId } });
  await tx.authToken.deleteMany({ where: { userId } });
  await tx.pushDevice.deleteMany({ where: { userId } });
  await tx.notification.deleteMany({ where: { userId } });
  await tx.syncReceipt.deleteMany({ where: { userId } });
  await tx.profileChangeRequest.updateMany({ where: { userId, status: 'PENDING', field: { not: DELETION_FIELD } }, data: { status: 'REJECTED', decidedAt: new Date() } });
}
