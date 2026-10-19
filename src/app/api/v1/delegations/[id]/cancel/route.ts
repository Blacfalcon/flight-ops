import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api';
import { notify } from '@/lib/notify';
import { audit } from '@/lib/audit';

export const POST = route({ perm: 'delegation.manage' }, async ({ auth, params }) => {
  const d = await db.delegation.findUnique({ where: { id: params.id } });
  if (!d) throw notFound('Delegation');
  await db.delegation.update({ where: { id: d.id }, data: { cancelledAt: new Date() } });
  await notify([d.toUserId], { kind: 'delegation.cancelled', title: 'Your acting Commander period has been ended', link: '/me' });
  await audit(auth.user.id, 'delegation.cancel', 'delegation', d.id, { before: d });
  return { ok: true };
});
