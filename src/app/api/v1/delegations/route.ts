import { db } from '@/lib/db';
import { invalid, route } from '@/lib/api';
import { delegationSchema } from '@/lib/validators';
import { nameOnly } from '@/lib/selects';
import { localToUtc } from '@/lib/time';
import { notify } from '@/lib/notify';
import { audit } from '@/lib/audit';

export const GET = route({ perm: ['delegation.manage', 'personnel.view'] }, async () => {
  return db.delegation.findMany({
    where: { cancelledAt: null, endsAt: { gt: new Date(Date.now() - 30 * 86_400_000) } },
    include: { fromUser: { select: nameOnly }, toUser: { select: nameOnly }, setBy: { select: nameOnly } },
    orderBy: { startsAt: 'desc' },
  });
});

/** The Commander (or Admin) appoints the GOO as acting Commander for a period. */
export const POST = route({ perm: 'delegation.manage', schema: delegationSchema }, async ({ auth, body }) => {
  const startsAt = localToUtc(body.startDate, body.startTime);
  const endsAt = localToUtc(body.endDate, body.endTime);
  if (endsAt <= startsAt) throw invalid('The end must be after the start.', { endDate: 'After the start.' });

  const [from, to] = await Promise.all([db.user.findUnique({ where: { id: body.fromUserId } }), db.user.findUnique({ where: { id: body.toUserId } })]);
  if (!from || from.appointment !== 'COMMANDER') throw invalid('Choose the Commander.', { fromUserId: 'Must be the Commander.' });
  if (!to || to.appointment !== 'GOO' || to.accountStatus !== 'ACTIVE') throw invalid('Only the GOO can act as Commander.', { toUserId: 'Must be the GOO.' });
  if (auth.user.appointment === 'COMMANDER' && auth.user.id !== from.id) throw invalid('You can only delegate your own command.');

  const d = await db.delegation.create({ data: { fromUserId: from.id, toUserId: to.id, startsAt, endsAt, setById: auth.user.id } });
  await notify([to.id], { kind: 'delegation.set', title: 'You are appointed acting Commander', link: '/me', email: true });
  await audit(auth.user.id, 'delegation.create', 'delegation', d.id, { after: d });
  return d;
});
