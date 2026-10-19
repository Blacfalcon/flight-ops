import { db } from '@/lib/db';
import { forbidden, notFound, route } from '@/lib/api';
import { userAdminUpdateSchema } from '@/lib/validators';
import { publicUser } from '@/lib/selects';
import { revokeAllSessions } from '@/lib/auth/session';
import { sendAccountActivatedEmail } from '@/lib/mail';
import { audit } from '@/lib/audit';

export const GET = route({ perm: 'personnel.view' }, async ({ params }) => {
  const user = await db.user.findUnique({ where: { id: params.id }, select: publicUser });
  if (!user) throw notFound('Person');
  return user;
});

export const PATCH = route({ perm: 'personnel.manage', schema: userAdminUpdateSchema }, async ({ auth, params, body }) => {
  const before = await db.user.findUnique({ where: { id: params.id }, select: publicUser });
  if (!before) throw notFound('Person');
  if (params.id === auth.user.id && body.accountStatus && body.accountStatus !== 'ACTIVE') throw forbidden('You cannot suspend your own account.');
  if (params.id === auth.user.id && body.appointment && body.appointment !== 'ADMIN') {
    const otherAdmins = await db.user.count({ where: { appointment: 'ADMIN', accountStatus: 'ACTIVE', id: { not: auth.user.id } } });
    if (!otherAdmins) throw forbidden('You are the only Admin. Appoint another Admin first.');
  }
  const data = { ...body };
  if (data.flightStatus === 'NONE') data.pilotCategory = 'NIL';
  const after = await db.user.update({ where: { id: params.id }, data, select: publicUser });

  if (body.accountStatus === 'SUSPENDED' || (body.appointment && body.appointment !== before.appointment)) await revokeAllSessions(params.id);
  if (body.accountStatus === 'ACTIVE' && before.accountStatus !== 'ACTIVE') {
    try {
      await sendAccountActivatedEmail(after.email);
    } catch (err) {
      console.error('activation email failed', err);
    }
  }
  await audit(auth.user.id, 'user.adminUpdate', 'user', params.id, { before, after });
  return after;
});
