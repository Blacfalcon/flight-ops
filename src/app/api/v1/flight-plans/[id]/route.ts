import { db } from '@/lib/db';
import { forbidden, notFound, route } from '@/lib/api';
import { flightPlanSchema } from '@/lib/validators';
import { saveFlightPlan } from '@/lib/services/flight-plans';
import { nameOnly } from '@/lib/selects';

export const GET = route({ perm: ['flightplan.viewAll', 'flightplan.create'] }, async ({ auth, params }) => {
  const p = await db.flightPlan.findUnique({
    where: { id: params.id },
    include: { submittedBy: { select: nameOnly }, approvedBy: { select: nameOnly }, mission: { select: { id: true, missionNo: true } } },
  });
  if (!p) throw notFound('Flight plan');
  if (!auth.perms.has('flightplan.viewAll') && p.submittedById !== auth.user.id) throw forbidden();
  return p;
});

export const PATCH = route({ perm: 'flightplan.create', schema: flightPlanSchema }, async ({ auth, params, body }) => {
  return saveFlightPlan(auth.user.id, body, params.id);
});
