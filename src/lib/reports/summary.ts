import type { SummaryPeriod } from '@prisma/client';
import { db } from '../db';
import { addDays, addMonths, dateOnly, localDate, localDayBounds, monthStart, quarterStart, weekStart } from '../time';
import { personName } from '../constants';

export type SummaryFigures = {
  period: SummaryPeriod;
  start: string; // inclusive local date
  end: string; // inclusive local date
  totals: {
    missions: number;
    completed: number;
    aborted: number;
    cancelled: number;
    flightHours: number;
    fuelKg: number;
    fuelL: number;
    successRate: number | null; // completed / (completed + aborted)
    openSnags: number;
  };
  byType: Array<{ type: string; missions: number; completed: number; aborted: number; hours: number }>;
  perDay: Array<{ date: string; missions: number; completed: number; aborted: number; hours: number; fuelKg: number }>;
  aircraft: Array<{ registration: string; sorties: number; hours: number; daysUnserviceable: number }>;
  abortReasons: Array<{ reason: string; count: number }>;
  personnel: {
    pilots: Array<{ name: string; sorties: number; hours: number; instructorHours: number; traineeHours: number }>;
    readinessRate: number | null;
    notAvailable: number;
  };
  maintenance: { snagsRaised: number; snagsClosed: number; avgDaysToClose: number | null };
  safety: { low: number; medium: number; high: number; rejected: number; hazards: number; incidents: number };
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The period that a report run on `today` should cover (the period just ended, or today for daily). */
export function periodRange(period: SummaryPeriod, anchor: string): { start: string; end: string } {
  switch (period) {
    case 'DAILY':
      return { start: anchor, end: anchor };
    case 'WEEKLY': {
      const start = weekStart(anchor);
      return { start, end: addDays(start, 6) };
    }
    case 'MONTHLY': {
      const start = monthStart(anchor);
      return { start, end: addDays(addMonths(start, 1), -1) };
    }
    case 'QUARTERLY': {
      const start = quarterStart(anchor);
      return { start, end: addDays(addMonths(start, 3), -1) };
    }
    default:
      throw new Error(`Unknown period ${String(period)}`);
  }
}

export async function computeSummary(period: SummaryPeriod, start: string, end: string): Promise<SummaryFigures> {
  const from = localDayBounds(start).start;
  const to = localDayBounds(end).end;

  const missions = await db.mission.findMany({
    where: { takeoffAt: { gte: from, lt: to }, status: { notIn: ['DRAFT', 'AWAITING_ENGINEERING'] } },
    include: { report: true, aircraft: true, crew: { include: { user: { omit: { photo: true } } } }, riskAssessments: true },
  });

  const totals = { missions: missions.length, completed: 0, aborted: 0, cancelled: 0, flightHours: 0, fuelKg: 0, fuelL: 0, successRate: null as number | null, openSnags: 0 };
  const byType = new Map<string, { type: string; missions: number; completed: number; aborted: number; hours: number }>();
  const perDay = new Map<string, { date: string; missions: number; completed: number; aborted: number; hours: number; fuelKg: number }>();
  const aircraft = new Map<string, { registration: string; sorties: number; hours: number; daysUnserviceable: number }>();
  const abort = new Map<string, number>();
  const pilots = new Map<string, { name: string; sorties: number; hours: number; instructorHours: number; traineeHours: number }>();
  let responses = 0;
  let ready = 0;
  let notAvailable = 0;

  for (let d = start; d <= end; d = addDays(d, 1)) perDay.set(d, { date: d, missions: 0, completed: 0, aborted: 0, hours: 0, fuelKg: 0 });

  for (const m of missions) {
    const day = localDate(m.takeoffAt);
    const hours = m.report ? m.report.flightTimeMin / 60 : 0;
    const fuelKg = m.report ? Number(m.report.fuelUsedKg) : 0;
    const fuelL = m.report ? Number(m.report.fuelUsedL) : 0;
    const t = byType.get(m.type) ?? { type: m.type, missions: 0, completed: 0, aborted: 0, hours: 0 };
    const pd = perDay.get(day);
    t.missions++;
    if (pd) pd.missions++;

    if (m.status === 'COMPLETED') {
      totals.completed++;
      t.completed++;
      if (pd) pd.completed++;
    } else if (m.status === 'ABORTED') {
      totals.aborted++;
      t.aborted++;
      if (pd) pd.aborted++;
      const reason = (m.report?.abortReason ?? 'Not stated').trim();
      abort.set(reason, (abort.get(reason) ?? 0) + 1);
    } else if (m.status === 'CANCELLED') {
      totals.cancelled++;
    }
    totals.flightHours += hours;
    totals.fuelKg += fuelKg;
    totals.fuelL += fuelL;
    t.hours += hours;
    if (pd) {
      pd.hours += hours;
      pd.fuelKg += fuelKg;
    }
    byType.set(m.type, t);

    if (m.report) {
      const a = aircraft.get(m.aircraftId) ?? { registration: m.aircraft.registration, sorties: 0, hours: 0, daysUnserviceable: 0 };
      a.sorties++;
      a.hours += hours;
      aircraft.set(m.aircraftId, a);
      for (const c of m.crew) {
        const p = pilots.get(c.userId) ?? { name: personName(c.user), sorties: 0, hours: 0, instructorHours: 0, traineeHours: 0 };
        p.sorties++;
        p.hours += hours;
        if (c.seat === 'INSTRUCTOR') p.instructorHours += hours;
        if (c.seat === 'TRAINEE') p.traineeHours += hours;
        pilots.set(c.userId, p);
      }
    }
    for (const c of m.crew) {
      if (c.readiness === 'READY' || c.readiness === 'NOT_AVAILABLE' || c.readiness === 'NO_RESPONSE') responses++;
      if (c.readiness === 'READY') ready++;
      if (c.readiness === 'NOT_AVAILABLE') notAvailable++;
    }
  }
  const flown = totals.completed + totals.aborted;
  totals.successRate = flown ? round1((totals.completed / flown) * 100) : null;
  totals.openSnags = await db.snag.count({ where: { status: 'OPEN' } });

  // Days each aircraft was confirmed anything but Serviceable
  const checks = await db.serviceabilityCheck.findMany({
    where: { flyingDate: { gte: dateOnly(start), lte: dateOnly(end) }, status: { not: 'SERVICEABLE' } },
    include: { aircraft: true },
  });
  for (const c of checks) {
    const a = aircraft.get(c.aircraftId) ?? { registration: c.aircraft.registration, sorties: 0, hours: 0, daysUnserviceable: 0 };
    a.daysUnserviceable++;
    aircraft.set(c.aircraftId, a);
  }

  const [raised, closed, ras, hazards, incidents] = await Promise.all([
    db.snag.count({ where: { createdAt: { gte: from, lt: to } } }),
    db.snag.findMany({ where: { closedAt: { gte: from, lt: to } }, select: { createdAt: true, closedAt: true } }),
    db.riskAssessment.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { level: true, status: true } }),
    db.safetyReport.count({ where: { kind: 'HAZARD', createdAt: { gte: from, lt: to } } }),
    db.safetyReport.count({ where: { kind: 'INCIDENT', createdAt: { gte: from, lt: to } } }),
  ]);
  const avgDays = closed.length
    ? round1(closed.reduce((s, c) => s + ((c.closedAt as Date).getTime() - c.createdAt.getTime()) / 86_400_000, 0) / closed.length)
    : null;

  return {
    period,
    start,
    end,
    totals: { ...totals, flightHours: round1(totals.flightHours), fuelKg: round1(totals.fuelKg), fuelL: round1(totals.fuelL) },
    byType: [...byType.values()].map((t) => ({ ...t, hours: round1(t.hours) })),
    perDay: [...perDay.values()].map((d) => ({ ...d, hours: round1(d.hours), fuelKg: round1(d.fuelKg) })),
    aircraft: [...aircraft.values()].map((a) => ({ ...a, hours: round1(a.hours) })).sort((a, b) => a.registration.localeCompare(b.registration)),
    abortReasons: [...abort.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    personnel: {
      pilots: [...pilots.values()].map((p) => ({ ...p, hours: round1(p.hours), instructorHours: round1(p.instructorHours), traineeHours: round1(p.traineeHours) })).sort((a, b) => b.hours - a.hours),
      readinessRate: responses ? round1((ready / responses) * 100) : null,
      notAvailable,
    },
    maintenance: { snagsRaised: raised, snagsClosed: closed.length, avgDaysToClose: avgDays },
    safety: {
      low: ras.filter((r) => r.level === 'LOW').length,
      medium: ras.filter((r) => r.level === 'MEDIUM').length,
      high: ras.filter((r) => r.level === 'HIGH').length,
      rejected: ras.filter((r) => r.status === 'REJECTED').length,
      hazards,
      incidents,
    },
  };
}
