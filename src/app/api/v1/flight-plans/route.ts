import { db } from '@/lib/db';
import { route } from '@/lib/api';
import { flightPlanSchema } from '@/lib/validators';
import { saveFlightPlan } from '@/lib/services/flight-plans';
import { nameOnly } from '@/lib/selects';

export const GET = route({ perm: ['flightplan.viewAll', 'flightplan.create'] }, async ({ auth, query }) => {
  const all = auth.perms.has('flightplan.viewAll') && query.get('mine') !== '1';
  const status = query.get('status');
  return db.flightPlan.findMany({
    where: { ...(all ? {} : { submittedById: auth.user.id }), ...(status ? { status: status as never } : {}) },
    include: { submittedBy: { select: nameOnly }, approvedBy: { select: nameOnly }, mission: { select: { id: true, missionNo: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
});

export const POST = route({ perm: 'flightplan.create', schema: flightPlanSchema }, async ({ auth, body }) => {
  return saveFlightPlan(auth.user.id, body);
});
