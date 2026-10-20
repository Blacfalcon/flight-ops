import { db } from '@/lib/db';
import { route } from '@/lib/api';
import { snagSchema } from '@/lib/validators';
import { nameOnly } from '@/lib/selects';
import { notify, usersWithAppointments } from '@/lib/notify';
import { audit } from '@/lib/audit';

export const GET = route({ perm: 'snag.view' }, async ({ query }) => {
  const status = query.get('status') === 'CLOSED' ? 'CLOSED' : query.get('status') === 'ALL' ? undefined : 'OPEN';
  return db.snag.findMany({
    where: { status, aircraftId: query.get('aircraftId') ?? undefined },
    include: { aircraft: { select: { registration: true } }, raisedBy: { select: nameOnly }, closedBy: { select: nameOnly }, missionReport: { select: { mission: { select: { missionNo: true, id: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
});

export const POST = route({ perm: ['snag.raise', 'snag.close'], schema: snagSchema }, async ({ auth, body }) => {
  const snag = await db.snag.create({ data: { aircraftId: body.aircraftId, description: body.description, raisedById: auth.user.id }, include: { aircraft: true } });
  await notify(await usersWithAppointments(['CO_ENGINEERING', 'ENGINEERING_OFFICER']), { kind: 'snag.raised', title: `Snag raised on ${snag.aircraft.registration}`, link: '/engineering/snags', email: true });
  await audit(auth.user.id, 'snag.raise', 'snag', snag.id, { after: snag });
  return snag;
});
