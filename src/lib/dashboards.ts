import { db } from './db';
import { listMissions } from './services/mission-queries';
import { listRisk } from './services/risk-queries';
import { addDays, dateOnly, localDate, localDayBounds } from './time';
import { getSettings } from './settings';
import { nameOnly } from './selects';

export async function commandDashboard() {
  const today = localDate();
  const [missions, aircraft, pending, todayChecks, orders] = await Promise.all([
    listMissions({ date: today, includeDrafts: false }),
    db.aircraft.findMany({ where: { active: true }, orderBy: { registration: 'asc' } }),
    listRisk('SUBMITTED'),
    db.serviceabilityCheck.findMany({ where: { flyingDate: dateOnly(today) }, include: { confirmedBy: { select: nameOnly } }, orderBy: { updatedAt: 'desc' } }),
    db.missionOrder.findMany({
      where: { status: 'SUBMITTED' },
      include: { mission: { select: { id: true, missionNo: true, name: true, type: true, takeoffAt: true } }, createdBy: { select: nameOnly } },
      orderBy: { submittedAt: 'asc' },
      take: 20,
    }),
  ]);
  const crew = missions.filter((m) => !['COMPLETED', 'ABORTED', 'CANCELLED'].includes(m.status)).flatMap((m) => m.crew);
  return {
    today,
    missions,
    aircraft,
    pending,
    orders,
    confirmedAt: todayChecks[0]?.updatedAt ?? null,
    confirmedBy: todayChecks[0]?.confirmedBy ?? null,
    readiness: {
      ready: crew.filter((c) => c.readiness === 'READY').length,
      total: crew.length,
      awaiting: crew.filter((c) => c.readiness === 'PENDING').length,
      notAvailable: crew.filter((c) => c.readiness === 'NOT_AVAILABLE' || c.readiness === 'NO_RESPONSE').length,
    },
    risk: {
      low: missions.filter((m) => m.riskAssessments[0]?.level === 'LOW').length,
      medium: missions.filter((m) => m.riskAssessments[0]?.level === 'MEDIUM').length,
      high: missions.filter((m) => m.riskAssessments[0]?.level === 'HIGH').length,
    },
  };
}

export async function engineeringDashboard() {
  const today = localDate();
  const tomorrow = addDays(today, 1);
  const s = await getSettings();
  const [aircraft, snags, checksTomorrow, checksToday] = await Promise.all([
    db.aircraft.findMany({ where: { active: true }, orderBy: { registration: 'asc' } }),
    db.snag.findMany({ where: { status: 'OPEN' }, include: { aircraft: { select: { registration: true } }, raisedBy: { select: nameOnly } }, orderBy: { createdAt: 'desc' } }),
    db.serviceabilityCheck.findMany({ where: { flyingDate: dateOnly(tomorrow) } }),
    db.serviceabilityCheck.findMany({ where: { flyingDate: dateOnly(today) } }),
  ]);
  const horizon = dateOnly(addDays(today, s.inspectionWarning.days));
  const dueSoon = aircraft.filter((a) => Number(a.hoursToNextInspection) <= s.inspectionWarning.hours || (a.nextInspectionDue && a.nextInspectionDue <= horizon));
  return { today, tomorrow, aircraft, snags, dueSoon, warning: s.inspectionWarning, checksTomorrow, checksToday };
}

export async function opsDashboard() {
  const today = localDate();
  const tomorrow = addDays(today, 1);
  const [todayMissions, tomorrowMissions, plans, metar, taf] = await Promise.all([
    listMissions({ date: today, includeDrafts: true }),
    listMissions({ date: tomorrow, includeDrafts: true }),
    db.flightPlan.findMany({ where: { status: 'SUBMITTED' }, include: { submittedBy: { select: nameOnly }, mission: { select: { id: true, missionNo: true } } }, orderBy: { submittedAt: 'asc' } }),
    db.weatherReport.findFirst({ where: { kind: 'METAR' }, orderBy: { createdAt: 'desc' } }),
    db.weatherReport.findFirst({ where: { kind: 'TAF' }, orderBy: { createdAt: 'desc' } }),
  ]);
  return { today, tomorrow, todayMissions, tomorrowMissions, plans, metar, taf };
}

export async function pilotDashboard(userId: string) {
  const today = localDate();
  const [upcoming, plans, recent, metar] = await Promise.all([
    listMissions({ from: today, to: addDays(today, 7), userId, includeDrafts: false }),
    db.flightPlan.findMany({ where: { submittedById: userId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    db.missionReport.findMany({
      where: { mission: { crew: { some: { userId } } } },
      include: { mission: { select: { missionNo: true, takeoffAt: true, type: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.weatherReport.findFirst({ where: { kind: 'METAR' }, orderBy: { createdAt: 'desc' } }),
  ]);
  const { start } = localDayBounds(`${today.slice(0, 7)}-01`);
  const monthMinutes = await db.missionReport.aggregate({
    where: { createdAt: { gte: start }, mission: { crew: { some: { userId } } } },
    _sum: { flightTimeMin: true },
  });
  return { today, upcoming: upcoming.filter((m) => !['CANCELLED'].includes(m.status)), plans, recent, metar, monthMinutes: monthMinutes._sum.flightTimeMin ?? 0 };
}

export async function safetyDashboard() {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [pending, recent, reports] = await Promise.all([
    listRisk('SUBMITTED'),
    db.riskAssessment.findMany({ where: { createdAt: { gte: since } }, select: { level: true, status: true } }),
    db.safetyReport.findMany({ where: { status: { not: 'CLOSED' } }, include: { reportedBy: { select: nameOnly }, aircraft: { select: { registration: true } } }, orderBy: { createdAt: 'desc' } }),
  ]);
  return {
    pending,
    last30: {
      low: recent.filter((r) => r.level === 'LOW').length,
      medium: recent.filter((r) => r.level === 'MEDIUM').length,
      high: recent.filter((r) => r.level === 'HIGH').length,
      rejected: recent.filter((r) => r.status === 'REJECTED').length,
    },
    reports,
  };
}
