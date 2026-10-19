import { db } from '../../lib/db';
import { notify, usersWithAppointments } from '../../lib/notify';
import { getSettings } from '../../lib/settings';
import { pilotInCommandSeat } from '../../lib/rules/pairing';
import { audit } from '../../lib/audit';

const min = (n: number) => n * 60_000;

/**
 * Runs every minute. Each step is idempotent: a timestamp on the mission records that it has fired,
 * so a restart or a slow minute never sends the same reminder twice.
 */
export async function missionClock(now: Date = new Date()) {
  const s = await getSettings();
  const { readinessMinutes, noResponseMinutes, riskMinutes } = s.reminders;

  // T-60: ask the crew to confirm readiness
  const toRequest = await db.mission.findMany({
    where: { status: 'PUBLISHED', readinessRequestedAt: null, takeoffAt: { gt: now, lte: new Date(now.getTime() + min(readinessMinutes)) } },
    include: { crew: true },
  });
  for (const m of toRequest) {
    const claimed = await db.mission.updateMany({ where: { id: m.id, readinessRequestedAt: null }, data: { readinessRequestedAt: now } });
    if (!claimed.count) continue;
    const pending = m.crew.filter((c) => c.readiness === 'PENDING').map((c) => c.userId);
    await notify(pending, { kind: 'readiness.request', title: `Confirm readiness for ${m.missionNo}`, link: `/missions/${m.id}`, email: true });
  }

  // T-45: flag anyone who has not replied
  const toFlag = await db.mission.findMany({
    where: {
      status: 'PUBLISHED',
      readinessRequestedAt: { not: null },
      noResponseFlaggedAt: null,
      takeoffAt: { gt: now, lte: new Date(now.getTime() + min(noResponseMinutes)) },
    },
    include: { crew: true },
  });
  for (const m of toFlag) {
    const claimed = await db.mission.updateMany({ where: { id: m.id, noResponseFlaggedAt: null }, data: { noResponseFlaggedAt: now } });
    if (!claimed.count) continue;
    const silent = m.crew.filter((c) => c.readiness === 'PENDING');
    if (!silent.length) continue;
    await db.missionCrew.updateMany({ where: { id: { in: silent.map((c) => c.id) } }, data: { readiness: 'NO_RESPONSE' } });
    const ops = await usersWithAppointments(['OPERATIONS_OFFICER']);
    const command = await usersWithAppointments(['CO_FLYING_WING', 'COMMANDER']);
    await notify(ops, { kind: 'readiness.noResponse', title: `${m.missionNo}: no readiness reply from ${silent.length} crew — swap crew`, link: `/missions/${m.id}`, email: true });
    await notify(command, { kind: 'readiness.noResponse', title: `${m.missionNo}: crew has not replied`, link: `/missions/${m.id}` });
    await audit(null, 'readiness.noResponseFlagged', 'mission', m.id, { after: { users: silent.map((c) => c.userId) } });
  }

  // T-30: remind the pilot in command to submit the risk assessment
  const toRemind = await db.mission.findMany({
    where: { status: { in: ['PUBLISHED', 'CREW_READY'] }, riskReminderSentAt: null, takeoffAt: { gt: now, lte: new Date(now.getTime() + min(riskMinutes)) } },
    include: { crew: true },
  });
  for (const m of toRemind) {
    const claimed = await db.mission.updateMany({ where: { id: m.id, riskReminderSentAt: null }, data: { riskReminderSentAt: now } });
    if (!claimed.count) continue;
    const picSeat = pilotInCommandSeat(m.crew.map((c) => c.seat));
    const pic = m.crew.find((c) => c.seat === picSeat);
    if (pic) await notify([pic.userId], { kind: 'risk.reminder', title: `${m.missionNo}: risk assessment due now`, link: `/missions/${m.id}/risk`, email: true });
  }

  // Take-off time passed without clearance
  const overdue = await db.mission.findMany({
    where: { status: { in: ['PUBLISHED', 'CREW_READY', 'RISK_SUBMITTED', 'AWAITING_ENGINEERING'] }, overdueFlaggedAt: null, takeoffAt: { lte: now } },
  });
  for (const m of overdue) {
    const claimed = await db.mission.updateMany({ where: { id: m.id, overdueFlaggedAt: null }, data: { overdueFlaggedAt: now } });
    if (!claimed.count) continue;
    const ops = await usersWithAppointments(['OPERATIONS_OFFICER', 'CO_FLYING_WING']);
    await notify(ops, { kind: 'mission.overdue', title: `${m.missionNo}: take-off time passed without clearance`, link: `/missions/${m.id}`, email: true });
  }
}
