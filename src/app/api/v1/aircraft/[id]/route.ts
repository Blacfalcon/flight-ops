import { db } from '@/lib/db';
import { forbidden, notFound, route } from '@/lib/api';
import { aircraftUpdateSchema } from '@/lib/validators';
import { updateAircraft } from '@/lib/services/aircraft';
import { nameOnly } from '@/lib/selects';

export const GET = route({ perm: 'aircraft.view' }, async ({ params }) => {
  const a = await db.aircraft.findUnique({
    where: { id: params.id },
    include: {
      history: { orderBy: { createdAt: 'desc' }, take: 100, include: { changedBy: { select: nameOnly } } },
      snags: { orderBy: { createdAt: 'desc' }, take: 100 },
      checks: { orderBy: { flyingDate: 'desc' }, take: 30 },
    },
  });
  if (!a) throw notFound('Aircraft');
  return a;
});

export const PATCH = route({ perm: 'aircraft.update', schema: aircraftUpdateSchema }, async ({ auth, params, body }) => {
  // Only Admin can retire an aircraft from the register
  if (body.active !== undefined && !auth.perms.has('aircraft.create')) throw forbidden('Only Admin can remove an aircraft from the register.');
  return updateAircraft(params.id, body, auth.user.id);
});
