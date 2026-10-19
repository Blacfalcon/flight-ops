import { db } from '@/lib/db';
import { route } from '@/lib/api';
import { nameOnly } from '@/lib/selects';

// Mission orders are raised with the sortie on the schedule (POST /missions) and edited with it
// (PATCH /missions/:id). This endpoint lists them.
export const GET = route({}, async ({ auth, query }) => {
  const seesAll = auth.perms.has('order.view');
  const status = query.get('status');
  const orders = await db.missionOrder.findMany({
    where: {
      ...(seesAll ? {} : { status: 'APPROVED', mission: { publishedAt: { not: null }, crew: { some: { userId: auth.user.id } } } }),
      ...(status === 'SUBMITTED' || status === 'APPROVED' || status === 'REJECTED' ? { status } : {}),
    },
    include: { mission: { select: { id: true, missionNo: true, name: true, takeoffAt: true, status: true } }, createdBy: { select: nameOnly } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const attachments = await db.attachment.findMany({ where: { entityType: 'mission_order', entityId: { in: orders.map((o) => o.id) } } });
  return orders.map((o) => ({ ...o, attachments: attachments.filter((a) => a.entityId === o.id) }));
});
