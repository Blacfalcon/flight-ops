import { Prisma, type Mission, type MissionStatus } from '@prisma/client';
import { db } from '../db';
import { ApiError, conflict, invalid, notFound } from '../api-errors';
import { audit } from '../audit';
import { notify, usersWithAppointments } from '../notify';
import { validateCrew, type CrewMember } from '../rules/pairing';
import { MISSION_CATEGORY_PREFIX, personName, type MissionCategoryValue } from '../constants';
import { nextOrderNo, notifyApprovers, orderChanged, type OrderFields } from './orders';
import { dateOnly, localDate, localTime, minutesBetween } from '../time';
import { formatHours, formatMinutes } from '../hours';

type Tx = Prisma.TransactionClient;

export const ACTIVE_STATUSES: MissionStatus[] = ['DRAFT', 'AWAITING_ENGINEERING', 'PUBLISHED', 'CREW_READY', 'RISK_SUBMITTED', 'CLEARED'];
export const FLOWN_OR_CLOSED: MissionStatus[] = ['COMPLETED', 'ABORTED', 'CANCELLED'];

export type CrewInput = Array<{ seat: CrewMember['seat']; userId: string }>;

export type MissionInput = {
  date: string; // local YYYY-MM-DD
  name: string;
  category: MissionCategoryValue;
  type: string;
  aircraftId: string;
  briefingAt: Date;
  takeoffAt: Date;
  landingAt: Date;
  crew: CrewInput;
  order: OrderFields;
};

async function nextMissionNo(tx: Tx, category: MissionCategoryValue, date: string): Promise<string> {
  const prefix = `${MISSION_CATEGORY_PREFIX[category]}-${date.slice(2, 4)}-`;
  const last = await tx.mission.findFirst({ where: { missionNo: { startsWith: prefix } }, orderBy: { missionNo: 'desc' }, select: { missionNo: true } });
  const n = last ? Number(last.missionNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
}

/** Field-level problems with times, aircraft, crew and overlaps. Empty array = valid. */
export async function checkMission(tx: Tx, input: MissionInput, missionId?: string): Promise<Record<string, string>> {
  const problems: Record<string, string> = {};

  if (!(input.briefingAt < input.takeoffAt)) problems.briefingAt = 'Briefing must be before take-off.';
  if (!(input.takeoffAt < input.landingAt)) problems.landingAt = 'Landing must be after take-off.';
  if (localDate(input.takeoffAt) !== input.date) problems.takeoffAt = 'Take-off must be on the mission date.';

  // Crew
  const users = await tx.user.findMany({
    where: { id: { in: input.crew.map((c) => c.userId) } },
    select: { id: true, rank: true, fullName: true, flightStatus: true, pilotCategory: true, accountStatus: true },
  });
  const byId = new Map(users.map((u) => [u.id, u] as const));
  const crew: CrewMember[] = [];
  for (const c of input.crew) {
    const u = byId.get(c.userId);
    if (!u || u.accountStatus !== 'ACTIVE') {
      problems[`crew.${c.seat}`] = 'That person is not an active user.';
      continue;
    }
    crew.push({ userId: u.id, seat: c.seat, flightStatus: u.flightStatus, pilotCategory: u.pilotCategory, name: personName(u) });
  }
  for (const e of validateCrew(crew)) if (!problems[e.field]) problems[e.field] = e.message;

  // Aircraft
  const aircraft = await tx.aircraft.findUnique({ where: { id: input.aircraftId } });
  if (!aircraft || !aircraft.active) {
    problems.aircraftId = 'Choose an aircraft.';
  } else {
    const planned = minutesBetween(input.takeoffAt, input.landingAt);
    if (Number(aircraft.hoursToNextInspection) * 60 < planned) {
      problems.aircraftId = `${aircraft.registration} has ${formatHours(Number(aircraft.hoursToNextInspection))} to inspection, less than the planned ${formatMinutes(planned)}.`;
    }
  }

  // Overlaps (briefing to landing) for the aircraft and every crew member
  if (!problems.briefingAt && !problems.landingAt) {
    const clashes = await tx.mission.findMany({
      where: {
        id: missionId ? { not: missionId } : undefined,
        status: { in: ACTIVE_STATUSES },
        briefingAt: { lt: input.landingAt },
        landingAt: { gt: input.briefingAt },
        OR: [{ aircraftId: input.aircraftId }, { crew: { some: { userId: { in: input.crew.map((c) => c.userId) } } } }],
      },
      include: { crew: true },
    });
    for (const m of clashes) {
      if (m.aircraftId === input.aircraftId && !problems.aircraftId) problems.aircraftId = `Aircraft already booked on ${m.missionNo} (${localTime(m.briefingAt)}–${localTime(m.landingAt)}).`;
      for (const c of input.crew) {
        if (m.crew.some((mc) => mc.userId === c.userId) && !problems[`crew.${c.seat}`]) {
          problems[`crew.${c.seat}`] = `Already crewed on ${m.missionNo} (${localTime(m.briefingAt)}–${localTime(m.landingAt)}).`;
        }
      }
    }
  }
  return problems;
}

/** Is the aircraft confirmed Serviceable by CO Engineering for this date, and still serviceable now? */
export async function aircraftConfirmed(tx: Tx, aircraftId: string, date: string): Promise<boolean> {
  const [check, aircraft] = await Promise.all([
    tx.serviceabilityCheck.findUnique({ where: { aircraftId_flyingDate: { aircraftId, flyingDate: dateOnly(date) } } }),
    tx.aircraft.findUnique({ where: { id: aircraftId }, select: { status: true } }),
  ]);
  return check?.status === 'SERVICEABLE' && aircraft?.status === 'SERVICEABLE';
}

export async function createMission(input: MissionInput, actorId: string): Promise<Mission> {
  return db.$transaction(async (tx) => {
    const problems = await checkMission(tx, input);
    if (Object.keys(problems).length) throw invalid('The mission cannot be saved.', problems);
    const confirmed = await aircraftConfirmed(tx, input.aircraftId, input.date);
    let mission: Mission | null = null;
    for (let attempt = 0; attempt < 3 && !mission; attempt++) {
      try {
        mission = await tx.mission.create({
          data: {
            missionNo: await nextMissionNo(tx, input.category, input.date),
            date: dateOnly(input.date),
            name: input.name,
            category: input.category,
            type: input.type,
            aircraftId: input.aircraftId,
            briefingAt: input.briefingAt,
            takeoffAt: input.takeoffAt,
            landingAt: input.landingAt,
            status: confirmed ? 'DRAFT' : 'AWAITING_ENGINEERING',
            createdById: actorId,
            crew: { create: input.crew.map((c) => ({ seat: c.seat, userId: c.userId })) },
          },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
    }
    if (!mission) throw conflict('Could not allocate a mission number. Try again.');
    // The mission order is raised in the same step and goes straight to CO Flying Wing and the Commander
    const order = await tx.missionOrder.create({
      data: { missionId: mission.id, orderNo: await nextOrderNo(tx, input.date), ...input.order, status: 'SUBMITTED', submittedAt: new Date(), createdById: actorId },
    });
    await notifyApprovers(tx, mission.id, mission.missionNo, order.orderNo, false);
    await audit(actorId, 'mission.create', 'mission', mission.id, { after: { ...mission, crew: input.crew, order } }, tx);
    return mission;
  });
}

export async function updateMission(id: string, input: MissionInput, actorId: string): Promise<Mission> {
  return db.$transaction(async (tx) => {
    const before = await tx.mission.findUnique({ where: { id }, include: { crew: true, order: true } });
    if (!before) throw notFound('Mission');
    if (FLOWN_OR_CLOSED.includes(before.status)) throw conflict('This mission is closed and cannot be changed.');
    const problems = await checkMission(tx, input, id);
    if (Object.keys(problems).length) throw invalid('The mission cannot be saved.', problems);

    const confirmed = await aircraftConfirmed(tx, input.aircraftId, input.date);
    const aircraftChanged = before.aircraftId !== input.aircraftId;
    const timesChanged = before.takeoffAt.getTime() !== input.takeoffAt.getTime();

    // Crew changes: keep readiness for unchanged people, reset for new ones
    const keep = new Map(before.crew.map((c) => [`${c.seat}:${c.userId}`, c]));
    const newcomers = input.crew.filter((c) => !keep.has(`${c.seat}:${c.userId}`));
    const removed = before.crew.filter((c) => !input.crew.some((n) => n.seat === c.seat && n.userId === c.userId));

    await tx.missionCrew.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
    for (const c of newcomers) await tx.missionCrew.create({ data: { missionId: id, seat: c.seat, userId: c.userId } });

    // Any change to aircraft, time or crew after publication sends the mission back through its gates
    let status: MissionStatus = before.status;
    const material = aircraftChanged || timesChanged || newcomers.length > 0 || removed.length > 0;
    if (!confirmed) status = 'AWAITING_ENGINEERING';
    else if (before.status === 'AWAITING_ENGINEERING') status = before.publishedAt ? 'PUBLISHED' : 'DRAFT';
    else if (material && ['CREW_READY', 'RISK_SUBMITTED', 'CLEARED'].includes(before.status)) status = 'PUBLISHED';

    if (material && ['RISK_SUBMITTED', 'CLEARED'].includes(before.status)) {
      await tx.riskAssessment.updateMany({ where: { missionId: id, status: { in: ['SUBMITTED', 'CLEARED'] } }, data: { status: 'WITHDRAWN' } });
    }

    const mission = await tx.mission.update({
      where: { id },
      data: {
        date: dateOnly(input.date),
        name: input.name,
        category: input.category,
        type: input.type,
        aircraftId: input.aircraftId,
        briefingAt: input.briefingAt,
        takeoffAt: input.takeoffAt,
        landingAt: input.landingAt,
        status,
        ...(timesChanged ? { readinessRequestedAt: null, noResponseFlaggedAt: null, riskReminderSentAt: null, overdueFlaggedAt: null } : {}),
      },
    });

    // Mission order: create it if an older mission has none; any material change after approval,
    // or any change to a returned order, sends it back to CO Flying Wing and the Commander.
    const typeChanged = before.type !== input.type || before.name !== input.name || before.category !== input.category;
    if (!before.order) {
      const order = await tx.missionOrder.create({
        data: { missionId: id, orderNo: await nextOrderNo(tx, input.date), ...input.order, status: 'SUBMITTED', submittedAt: new Date(), createdById: actorId },
      });
      await notifyApprovers(tx, id, mission.missionNo, order.orderNo, false);
    } else {
      const changed = orderChanged(before.order, input.order);
      const resubmit = before.order.status === 'REJECTED' || before.order.status === 'DRAFT' || (before.order.status === 'APPROVED' && (changed || material || typeChanged));
      await tx.missionOrder.update({
        where: { id: before.order.id },
        data: {
          ...input.order,
          ...(resubmit ? { status: 'SUBMITTED', submittedAt: new Date(), decidedById: null, decidedAt: null, decisionRemarks: null, selfAuthorised: false } : {}),
        },
      });
      if (resubmit) await notifyApprovers(tx, id, mission.missionNo, before.order.orderNo, before.order.status === 'APPROVED');
    }

    if (before.publishedAt) {
      const crewIds = [...input.crew.map((c) => c.userId), ...removed.map((r) => r.userId)];
      await notify(crewIds, { kind: 'mission.changed', title: `${mission.missionNo} has changed`, link: `/missions/${id}`, email: true }, tx);
      // A replacement added after the T-60 call is asked for readiness straight away
      if (mission.readinessRequestedAt && newcomers.length) {
        await notify(newcomers.map((n) => n.userId), { kind: 'readiness.request', title: `Confirm readiness for ${mission.missionNo}`, link: `/missions/${id}`, email: true }, tx);
      }
    }
    await audit(actorId, 'mission.update', 'mission', id, { before, after: { ...mission, crew: input.crew } }, tx);
    return mission;
  });
}

/** Publish the given missions. Every one must pass its checks and have a confirmed-serviceable aircraft. */
export async function publishMissions(ids: string[], actorId: string) {
  return db.$transaction(async (tx) => {
    const missions = await tx.mission.findMany({ where: { id: { in: ids } }, include: { crew: true, aircraft: true, order: true } });
    if (missions.length !== ids.length) throw notFound('Mission');
    const blocked: Record<string, string> = {};
    for (const m of missions) {
      if (!['DRAFT', 'AWAITING_ENGINEERING'].includes(m.status)) continue;
      const date = localDate(m.takeoffAt);
      if (m.order?.status !== 'APPROVED') {
        blocked[m.missionNo] = m.order ? 'The mission order is not yet approved by CO Flying Wing or the Commander.' : 'The mission has no mission order. Edit it to add one.';
        continue;
      }
      if (!(await aircraftConfirmed(tx, m.aircraftId, date))) {
        blocked[m.missionNo] = `${m.aircraft.registration} is not confirmed serviceable for ${date}.`;
        continue;
      }
      const problems = await checkMission(
        tx,
        { date, name: m.name, category: m.category, type: m.type, order: m.order, aircraftId: m.aircraftId, briefingAt: m.briefingAt, takeoffAt: m.takeoffAt, landingAt: m.landingAt, crew: m.crew.map((c) => ({ seat: c.seat, userId: c.userId })) },
        m.id,
      );
      const first = Object.values(problems)[0];
      if (first) blocked[m.missionNo] = first;
    }
    if (Object.keys(blocked).length) throw new ApiError(409, 'publish_blocked', 'Some missions cannot be published yet.', blocked);

    const now = new Date();
    for (const m of missions) {
      if (!['DRAFT', 'AWAITING_ENGINEERING'].includes(m.status)) continue;
      await tx.mission.update({ where: { id: m.id }, data: { status: 'PUBLISHED', publishedAt: now } });
      await notify(m.crew.map((c) => c.userId), { kind: 'mission.assigned', title: `New mission ${m.missionNo} on ${localDate(m.takeoffAt)}`, link: `/missions/${m.id}`, email: true }, tx);
      await audit(actorId, 'mission.publish', 'mission', m.id, { after: { status: 'PUBLISHED' } }, tx);
    }
    return { published: missions.filter((m) => ['DRAFT', 'AWAITING_ENGINEERING'].includes(m.status)).map((m) => m.missionNo) };
  });
}

export async function cancelMission(id: string, reason: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const m = await tx.mission.findUnique({ where: { id }, include: { crew: true } });
    if (!m) throw notFound('Mission');
    if (FLOWN_OR_CLOSED.includes(m.status)) throw conflict('This mission is already closed.');
    if (m.takeoffAt < new Date() && m.status === 'CLEARED') throw conflict('The mission has taken off; the crew should close it as Aborted.');
    await tx.mission.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: reason } });
    await tx.riskAssessment.updateMany({ where: { missionId: id, status: 'SUBMITTED' }, data: { status: 'WITHDRAWN' } });
    if (m.publishedAt) await notify(m.crew.map((c) => c.userId), { kind: 'mission.cancelled', title: `${m.missionNo} cancelled`, link: `/missions/${id}`, email: true }, tx);
    await audit(actorId, 'mission.cancel', 'mission', id, { before: { status: m.status }, after: { status: 'CANCELLED', reason } }, tx);
  });
}

/** Called when CO Engineering marks an aircraft anything other than Serviceable */
export async function onAircraftUnavailable(tx: Tx, aircraftId: string, actorId: string | null) {
  const affected = await tx.mission.findMany({
    where: { aircraftId, status: { in: ['DRAFT', 'PUBLISHED', 'CREW_READY', 'RISK_SUBMITTED', 'CLEARED'] }, landingAt: { gt: new Date() } },
    include: { crew: true },
  });
  if (!affected.length) return [];
  const staff = await usersWithAppointments(['OPERATIONS_OFFICER', 'TRAINING_OFFICER', 'CO_FLYING_WING'], tx);
  for (const m of affected) {
    await tx.mission.update({ where: { id: m.id }, data: { status: 'AWAITING_ENGINEERING' } });
    await tx.riskAssessment.updateMany({ where: { missionId: m.id, status: { in: ['SUBMITTED', 'CLEARED'] } }, data: { status: 'WITHDRAWN' } });
    await notify([...staff, ...m.crew.map((c) => c.userId)], { kind: 'aircraft.unavailable', title: `${m.missionNo}: aircraft no longer serviceable — re-assign`, link: `/missions/${m.id}`, email: true }, tx);
    await audit(actorId, 'mission.aircraftWithdrawn', 'mission', m.id, { before: { status: m.status }, after: { status: 'AWAITING_ENGINEERING' } }, tx);
  }
  return affected.map((m) => m.missionNo);
}

/** After CO Engineering confirms an aircraft for a date, missions waiting on it move forward */
export async function onAircraftConfirmed(tx: Tx, aircraftId: string, date: string) {
  const waiting = await tx.mission.findMany({ where: { aircraftId, status: 'AWAITING_ENGINEERING', date: dateOnly(date) } });
  for (const m of waiting) {
    await tx.mission.update({ where: { id: m.id }, data: { status: m.publishedAt ? 'PUBLISHED' : 'DRAFT' } });
  }
}

export async function respondReadiness(missionId: string, userId: string, ready: boolean, reason: string | undefined) {
  return db.$transaction(async (tx) => {
    const m = await tx.mission.findUnique({ where: { id: missionId }, include: { crew: true } });
    if (!m) throw notFound('Mission');
    const seat = m.crew.find((c) => c.userId === userId);
    if (!seat) throw new ApiError(403, 'forbidden', 'You are not crewed on this mission.');
    if (!['PUBLISHED', 'CREW_READY'].includes(m.status)) throw conflict('Readiness can only be given for a published mission that is not yet cleared.');
    if (!ready && !reason?.trim()) throw invalid('Give a reason.', { reason: 'Required when not available.' });

    await tx.missionCrew.update({
      where: { id: seat.id },
      data: { readiness: ready ? 'READY' : 'NOT_AVAILABLE', readinessReason: ready ? null : reason!.trim(), respondedAt: new Date() },
    });
    const crew = await tx.missionCrew.findMany({ where: { missionId } });
    const allReady = crew.every((c) => c.readiness === 'READY');
    const status: MissionStatus = allReady ? 'CREW_READY' : 'PUBLISHED';
    if (status !== m.status) await tx.mission.update({ where: { id: missionId }, data: { status } });

    if (!ready) {
      const staff = await usersWithAppointments(['OPERATIONS_OFFICER', 'CO_FLYING_WING', 'COMMANDER'], tx);
      await notify(staff, { kind: 'readiness.notAvailable', title: `${m.missionNo}: a crew member is not available`, link: `/missions/${missionId}`, email: true }, tx);
    }
    await audit(userId, ready ? 'readiness.ready' : 'readiness.notAvailable', 'mission', missionId, { after: { reason } }, tx);
    return { status, allReady };
  });
}
