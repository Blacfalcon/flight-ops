import { db } from '../../lib/db';
import { notify, usersWithAppointments } from '../../lib/notify';
import { getSettings } from '../../lib/settings';
import { onAircraftUnavailable } from '../../lib/services/missions';
import { audit } from '../../lib/audit';
import { addDays, dateOnly, localDate } from '../../lib/time';

/** Daily: inspection and maintenance warnings; aircraft at their limit become Inspection Due. */
export async function inspectionCheck() {
  const s = await getSettings();
  const today = localDate();
  const horizon = dateOnly(addDays(today, s.inspectionWarning.days));
  const aircraft = await db.aircraft.findMany({ where: { active: true } });
  const recipients = await usersWithAppointments(['CO_ENGINEERING', 'ENGINEERING_OFFICER', 'OPERATIONS_OFFICER']);

  for (const a of aircraft) {
    const hrs = Number(a.hoursToNextInspection);
    const dueByDate = a.nextInspectionDue && a.nextInspectionDue <= dateOnly(today);
    const dueByHours = hrs <= 0;
    if ((dueByDate || dueByHours) && a.status === 'SERVICEABLE') {
      await db.$transaction(async (tx) => {
        await tx.aircraft.update({ where: { id: a.id }, data: { status: 'INSPECTION_DUE' } });
        await tx.aircraftStatusHistory.create({
          data: { aircraftId: a.id, status: 'INSPECTION_DUE', flyingHours: a.flyingHours, hoursToNextInspection: a.hoursToNextInspection, remarks: 'Inspection limit reached (automatic)' },
        });
        await onAircraftUnavailable(tx, a.id, null);
      });
      await audit(null, 'aircraft.inspectionDueAuto', 'aircraft', a.id, { after: { status: 'INSPECTION_DUE' } });
      await notify(recipients, { kind: 'inspection.due', title: `${a.registration} has reached its inspection limit`, link: `/aircraft/${a.id}`, email: true });
    } else if (hrs <= s.inspectionWarning.hours || (a.nextInspectionDue && a.nextInspectionDue <= horizon)) {
      await notify(recipients, { kind: 'maintenance.warning', title: `${a.registration}: inspection due soon (${hrs.toFixed(1)} h left)`, link: `/aircraft/${a.id}`, email: true });
    }
  }
}

/** Daily: remove expired sessions and used or expired one-time tokens. */
export async function housekeeping() {
  const now = new Date();
  await db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } }] } });
  await db.authToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } });
  await db.syncReceipt.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } } });
}
