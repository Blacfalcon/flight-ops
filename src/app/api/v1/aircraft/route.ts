import { db } from '@/lib/db';
import { route } from '@/lib/api';
import { aircraftCreateSchema } from '@/lib/validators';
import { dateOnly } from '@/lib/time';
import { audit } from '@/lib/audit';

export const GET = route({ perm: 'aircraft.view' }, async ({ query }) => {
  const includeInactive = query.get('all') === '1';
  return db.aircraft.findMany({
    where: includeInactive ? {} : { active: true },
    include: { _count: { select: { snags: { where: { status: 'OPEN' } } } } },
    orderBy: { registration: 'asc' },
  });
});

export const POST = route({ perm: 'aircraft.create', schema: aircraftCreateSchema }, async ({ auth, body }) => {
  const a = await db.aircraft.create({
    data: {
      registration: body.registration.toUpperCase(),
      type: body.type,
      status: body.status,
      flyingHours: body.flyingHours,
      hoursToNextInspection: body.hoursToNextInspection,
      inspectionIntervalHours: body.inspectionIntervalHours,
      inspectionIntervalDays: body.inspectionIntervalDays ?? null,
      lastInspectionDate: body.lastInspectionDate ? dateOnly(body.lastInspectionDate) : null,
      nextInspectionDue: body.nextInspectionDue ? dateOnly(body.nextInspectionDue) : null,
      maintenanceRemarks: body.maintenanceRemarks ?? null,
    },
  });
  await db.aircraftStatusHistory.create({
    data: { aircraftId: a.id, status: a.status, flyingHours: a.flyingHours, hoursToNextInspection: a.hoursToNextInspection, remarks: 'Added to the register', changedById: auth.user.id },
  });
  await audit(auth.user.id, 'aircraft.create', 'aircraft', a.id, { after: a });
  return a;
});
