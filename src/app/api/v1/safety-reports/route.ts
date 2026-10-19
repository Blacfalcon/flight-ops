import { db } from '@/lib/db';
import { route } from '@/lib/api';
import { safetyReportSchema } from '@/lib/validators';
import { nameOnly } from '@/lib/selects';
import { notify, usersWithAppointments } from '@/lib/notify';
import { audit } from '@/lib/audit';

export const GET = route({ perm: ['safety.view', 'safety.raise'] }, async ({ auth, query }) => {
  const all = auth.perms.has('safety.view');
  const status = query.get('status');
  return db.safetyReport.findMany({
    where: { ...(all ? {} : { reportedById: auth.user.id }), ...(status ? { status: status as never } : {}) },
    include: { reportedBy: { select: nameOnly }, aircraft: { select: { registration: true } }, mission: { select: { id: true, missionNo: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
});

export const POST = route({ perm: 'safety.raise', schema: safetyReportSchema }, async ({ auth, body }) => {
  const r = await db.safetyReport.create({ data: { ...body, aircraftId: body.aircraftId ?? null, missionId: body.missionId ?? null, reportedById: auth.user.id } });
  await notify(await usersWithAppointments(['SAFETY_OFFICER']), { kind: 'safety.raised', title: `New ${body.kind.toLowerCase()} report`, link: '/safety', email: true });
  await audit(auth.user.id, 'safety.raise', 'safety_report', r.id, { after: r });
  return r;
});
