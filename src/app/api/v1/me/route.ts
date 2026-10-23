import { db } from '@/lib/db';
import { conflict, invalid, route } from '@/lib/api';
import { meUpdateSchema } from '@/lib/validators';
import { APPOINTMENTS, FLIGHT_STATUSES, PILOT_CATEGORIES, RANKS } from '@/lib/constants';
import { notify } from '@/lib/notify';
import { audit } from '@/lib/audit';

export const GET = route({}, async ({ auth }) => {
  const { passwordHash, totpSecretEnc, ...user } = auth.user;
  void passwordHash;
  void totpSecretEnc;
  const pending = await db.profileChangeRequest.findMany({ where: { userId: auth.user.id, status: 'PENDING' } });
  return { user, roles: auth.roles, permissions: [...auth.perms], actingCommander: auth.actingCommander, pendingChanges: pending };
});

const ALLOWED: Record<string, readonly string[]> = {
  rank: RANKS,
  appointment: APPOINTMENTS,
  flightStatus: FLIGHT_STATUSES,
  pilotCategory: PILOT_CATEGORIES,
};

// Phone and name change directly. Rank, appointment, flight status and pilot category need Admin approval.
export const PATCH = route({ schema: meUpdateSchema }, async ({ auth, body }) => {
  const me = auth.user;
  if (body.phone) {
    const after = await db.user.update({ where: { id: me.id }, data: { phone: body.phone } });
    await audit(me.id, 'user.updateSelf', 'user', me.id, { before: { phone: me.phone }, after: { phone: after.phone } });
  }
  if (body.emailAlerts && body.emailAlerts !== me.emailAlerts) {
    await db.user.update({ where: { id: me.id }, data: { emailAlerts: body.emailAlerts }, select: { id: true } });
    await audit(me.id, 'user.emailAlerts', 'user', me.id, { before: { emailAlerts: me.emailAlerts }, after: { emailAlerts: body.emailAlerts } });
  }
  if (body.requestChange) {
    const { field, value, reason } = body.requestChange;
    if (!ALLOWED[field].includes(value)) throw invalid('That value is not allowed.', { [field]: 'Not allowed.' });
    const current = String(me[field as keyof typeof me]);
    if (current === value) throw invalid('That is already your current value.');
    const open = await db.profileChangeRequest.findFirst({ where: { userId: me.id, field, status: 'PENDING' } });
    if (open) throw conflict('You already have a pending request for this. Wait for Admin to decide.');
    const reqRow = await db.profileChangeRequest.create({ data: { userId: me.id, field, oldValue: current, newValue: value, reason: reason ?? null } });
    const admins = await db.user.findMany({ where: { appointment: 'ADMIN', accountStatus: 'ACTIVE' }, select: { id: true } });
    await notify(admins.map((a) => a.id), { kind: 'changeRequest.new', title: 'A profile change is waiting for approval', link: '/admin/requests', email: true });
    await audit(me.id, 'user.requestChange', 'profile_change_request', reqRow.id, { after: reqRow });
  }
  return { ok: true };
});
