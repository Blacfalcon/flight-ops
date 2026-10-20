import { db } from '@/lib/db';
import { conflict, notFound, route } from '@/lib/api';
import { decideRequestSchema } from '@/lib/validators';
import { revokeAllSessions } from '@/lib/auth/session';
import { notify } from '@/lib/notify';
import { audit } from '@/lib/audit';
import { DELETION_FIELD, deleteAccountData } from '@/lib/services/account-deletion';

export const POST = route({ perm: 'changeRequest.decide', schema: decideRequestSchema }, async ({ auth, params, body }) => {
  const r = await db.profileChangeRequest.findUnique({ where: { id: params.id } });
  if (!r) throw notFound('Request');
  if (r.status !== 'PENDING') throw conflict('This request has already been decided.');

  await db.$transaction(async (tx) => {
    await tx.profileChangeRequest.update({
      where: { id: r.id },
      data: { status: body.approve ? 'APPROVED' : 'REJECTED', decidedById: auth.user.id, decidedAt: new Date() },
    });
    if (body.approve && r.field === DELETION_FIELD) {
      await deleteAccountData(tx, r.userId);
    } else if (body.approve) {
      const data: Record<string, string> = { [r.field]: r.newValue };
      if (r.field === 'flightStatus' && r.newValue === 'NONE') data.pilotCategory = 'NIL';
      await tx.user.update({ where: { id: r.userId }, data });
    }
  });
  if (body.approve && r.field === 'appointment') await revokeAllSessions(r.userId); // new permissions on next sign-in
  if (r.field !== DELETION_FIELD || !body.approve) {
    const what = r.field === DELETION_FIELD ? 'account deletion request' : `${r.field} change`;
    await notify([r.userId], { kind: 'changeRequest.decided', title: `Your ${what} was ${body.approve ? 'approved' : 'not approved'}`, link: '/me' });
  }
  await audit(auth.user.id, body.approve ? 'changeRequest.approve' : 'changeRequest.reject', 'profile_change_request', r.id, { before: r });
  return { ok: true };
});
