import type { ApproverRole, Prisma } from '@prisma/client';
import { db } from '../db';
import { ApiError, conflict, forbidden, invalid, notFound } from '../api-errors';
import { audit } from '../audit';
import { notify, usersWithAppointments } from '../notify';
import { getSettings } from '../settings';
import { computeRisk, validRatings, weatherRatingFrom, type Imsafe, type Ratings } from '../rules/risk';
import { pilotInCommandSeat } from '../rules/pairing';
import { localTime } from '../time';
import { expiresAt, isExpired } from '../weather/validity';

type Tx = Prisma.TransactionClient;

const ROLE_APPOINTMENT: Record<ApproverRole, string> = {
  COMMANDER: 'COMMANDER',
  CO_FLYING_WING: 'CO_FLYING_WING',
  CO_ENGINEERING: 'CO_ENGINEERING',
  OPERATIONS_OFFICER: 'OPERATIONS_OFFICER',
};

function isNight(at: Date): boolean {
  const t = localTime(at);
  return t >= '18:45' || t < '06:15'; // approximate civil twilight across Nigeria (WAT)
}

/** Suggested weather rating for a mission, from the latest METAR */
export async function weatherSuggestion(takeoffAt: Date) {
  const [settings, metar] = await Promise.all([
    getSettings(),
    db.weatherReport.findFirst({ where: { kind: 'METAR' }, orderBy: { createdAt: 'desc' } }),
  ]);
  // An expired METAR is never used: the crew is told to get a current one
  const current = metar && !isExpired(metar) ? metar : null;
  const s = weatherRatingFrom(current ? { visibilityM: current.visibilityM, ceilingFt: current.ceilingFt } : null, settings.vmcMinima, isNight(takeoffAt));
  const expiredAt = metar && !current ? expiresAt(metar) : null;
  return {
    ...s,
    note: current
      ? s.note
      : expiredAt
        ? `The latest METAR expired at ${expiredAt.toISOString().slice(11, 16)}Z. Ask the Operations Officer for a current one`
        : 'No METAR has been entered. Ask the Operations Officer for one',
    current: !!current,
    metarRaw: current?.rawText ?? null,
    observedAt: current?.observedAt ?? null,
  };
}

async function approverIds(tx: Tx, roles: ApproverRole[]): Promise<string[]> {
  return usersWithAppointments(roles.map((r) => ROLE_APPOINTMENT[r]), tx);
}

export async function submitRisk(args: {
  missionId: string;
  userId: string;
  ratings: Ratings;
  imsafe: Imsafe;
  weatherLoweredReason?: string;
  mitigations?: string;
}) {
  if (!validRatings(args.ratings)) throw invalid('Every category needs a rating from 1 to 5.');
  const settings = await getSettings();
  const mission = await db.mission.findUnique({ where: { id: args.missionId }, include: { crew: true } });
  if (!mission) throw notFound('Mission');

  const pic = pilotInCommandSeat(mission.crew.map((c) => c.seat));
  const me = mission.crew.find((c) => c.userId === args.userId);
  if (!me) throw forbidden('You are not crewed on this mission.');
  if (me.seat !== pic) throw forbidden('The pilot in command submits the risk assessment. Other crew add their IMSAFE check to it.');
  if (mission.status !== 'CREW_READY') throw conflict('The whole crew must confirm READY before the risk assessment is submitted.');

  const suggestion = await weatherSuggestion(mission.takeoffAt);
  if (!suggestion.current) throw conflict(`${suggestion.note}. A risk assessment needs a current METAR.`);
  if (args.ratings.weather < suggestion.rating && !args.weatherLoweredReason?.trim()) {
    throw invalid('Give a reason for rating the weather lower than the METAR suggests.', { weatherLoweredReason: `METAR suggests ${suggestion.rating}.` });
  }

  const result = computeRisk(args.ratings, [args.imsafe], settings.riskThresholds);
  if (result.mitigationRequired && !args.mitigations?.trim()) {
    throw invalid('Write a mitigation: a category is rated 4 or 5, or the level is High.', { mitigations: 'Required.' });
  }

  return db.$transaction(async (tx) => {
    const open = await tx.riskAssessment.findFirst({ where: { missionId: mission.id, status: 'SUBMITTED' } });
    if (open) throw conflict('A risk assessment for this mission is already awaiting approval.');
    const last = await tx.riskAssessment.findFirst({ where: { missionId: mission.id }, orderBy: { version: 'desc' } });
    const required = settings.requiredApprovers as ApproverRole[];

    const ra = await tx.riskAssessment.create({
      data: {
        missionId: mission.id,
        version: (last?.version ?? 0) + 1,
        submittedById: args.userId,
        ...args.ratings,
        weatherLoweredReason: args.weatherLoweredReason?.trim() || null,
        mitigations: args.mitigations?.trim() || null,
        totalScore: result.score,
        level: result.level,
        levelReason: result.reason,
        requiredRoles: required,
        imsafe: { create: { userId: args.userId, ...args.imsafe } },
        approvals: { create: required.map((approverRole) => ({ approverRole })) },
      },
    });
    await tx.mission.update({ where: { id: mission.id }, data: { status: 'RISK_SUBMITTED' } });

    const others = mission.crew.filter((c) => c.userId !== args.userId).map((c) => c.userId);
    await notify(others, { kind: 'imsafe.request', title: `${mission.missionNo}: add your IMSAFE check`, link: `/missions/${mission.id}/risk`, email: true }, tx);
    await notify(await approverIds(tx, required), { kind: 'risk.approvalRequest', title: `${mission.missionNo}: risk assessment awaiting your decision (${result.level})`, link: `/risk/${ra.id}`, email: true }, tx);
    const safety = await usersWithAppointments(['SAFETY_OFFICER'], tx);
    await notify(safety, { kind: 'risk.submitted', title: `${mission.missionNo}: risk assessment submitted (${result.level})`, link: `/risk/${ra.id}`, email: result.hardImsafe }, tx);
    await audit(args.userId, 'risk.submit', 'risk_assessment', ra.id, { after: { ...args.ratings, score: result.score, level: result.level } }, tx);
    return ra;
  });
}

/** Another crew member adds their IMSAFE answers; the score is recalculated. */
export async function submitImsafe(riskId: string, userId: string, answers: Imsafe & { notes?: string }) {
  const settings = await getSettings();
  return db.$transaction(async (tx) => {
    const ra = await tx.riskAssessment.findUnique({ where: { id: riskId }, include: { mission: { include: { crew: true } }, imsafe: true } });
    if (!ra) throw notFound('Risk assessment');
    if (!ra.mission.crew.some((c) => c.userId === userId)) throw forbidden('You are not crewed on this mission.');
    if (ra.status !== 'SUBMITTED') throw conflict('This risk assessment is no longer open.');

    const { notes, ...flags } = answers;
    await tx.imsafeCheck.upsert({
      where: { riskAssessmentId_userId: { riskAssessmentId: riskId, userId } },
      create: { riskAssessmentId: riskId, userId, ...flags, notes: notes ?? null },
      update: { ...flags, notes: notes ?? null },
    });
    const all = await tx.imsafeCheck.findMany({ where: { riskAssessmentId: riskId } });
    const ratings: Ratings = {
      weather: ra.weather,
      aircraftCondition: ra.aircraftCondition,
      crewReadiness: ra.crewReadiness,
      missionComplexity: ra.missionComplexity,
      fuelStatus: ra.fuelStatus,
      terrain: ra.terrain,
      fatigue: ra.fatigue,
      operationalThreats: ra.operationalThreats,
    };
    const result = computeRisk(ratings, all, settings.riskThresholds);
    await tx.riskAssessment.update({ where: { id: riskId }, data: { totalScore: result.score, level: result.level, levelReason: result.reason } });
    if (result.level !== ra.level) {
      const ids = await approverIds(tx, ra.requiredRoles);
      await notify([...ids, ...(await usersWithAppointments(['SAFETY_OFFICER'], tx))], { kind: 'risk.levelChanged', title: `${ra.mission.missionNo}: risk level now ${result.level} after IMSAFE`, link: `/risk/${riskId}`, email: result.hardImsafe }, tx);
    }
    await audit(userId, 'risk.imsafe', 'risk_assessment', riskId, { after: flags }, tx);
    return { score: result.score, level: result.level };
  });
}

export async function decideRisk(args: {
  riskId: string;
  userId: string;
  appointment: string;
  myApproverRoles: ApproverRole[];
  role: ApproverRole;
  decision: 'APPROVE' | 'APPROVE_WITH_REMARKS' | 'REJECT';
  remarks?: string;
}) {
  return db.$transaction(async (tx) => {
    const ra = await tx.riskAssessment.findUnique({
      where: { id: args.riskId },
      include: { mission: { include: { crew: true, order: { select: { status: true } } } }, imsafe: true, approvals: true },
    });
    if (!ra) throw notFound('Risk assessment');
    if (args.decision !== 'REJECT' && ra.mission.order?.status !== 'APPROVED') {
      throw conflict('The mission order has changed and is awaiting approval. Approve the order first.');
    }
    if (ra.status !== 'SUBMITTED') throw conflict('This risk assessment is no longer awaiting decisions.');
    if (!args.myApproverRoles.includes(args.role)) throw forbidden('You cannot decide for that role.');
    const slot = ra.approvals.find((a) => a.approverRole === args.role);
    if (!slot) throw forbidden('That role is not a required approver for this assessment.');
    if (slot.decision) throw conflict('This role has already decided.');
    if (ra.mission.crew.some((c) => c.userId === args.userId)) throw forbidden('You cannot approve a mission you are crewed on.');

    const missingImsafe = ra.mission.crew.filter((c) => !ra.imsafe.some((i) => i.userId === c.userId));
    if (missingImsafe.length) throw new ApiError(409, 'imsafe_incomplete', 'Wait until every crew member has completed IMSAFE.');

    const needsRemarks = args.decision !== 'APPROVE' || ra.level === 'HIGH';
    if (needsRemarks && !args.remarks?.trim()) {
      throw invalid(ra.level === 'HIGH' ? 'High-risk assessments need remarks from every approver.' : 'Remarks are required for this decision.', { remarks: 'Required.' });
    }

    await tx.riskApproval.update({
      where: { id: slot.id },
      data: {
        approverId: args.userId,
        decision: args.decision,
        remarks: args.remarks?.trim() || null,
        decidedAt: new Date(),
        actingFor: args.role === 'COMMANDER' && args.appointment === 'GOO',
      },
    });

    const crewIds = ra.mission.crew.map((c) => c.userId);
    const ops = await usersWithAppointments(['OPERATIONS_OFFICER'], tx);
    let outcome: 'pending' | 'cleared' | 'rejected' = 'pending';

    if (args.decision === 'REJECT') {
      outcome = 'rejected';
      await tx.riskAssessment.update({ where: { id: ra.id }, data: { status: 'REJECTED' } });
      await tx.mission.update({ where: { id: ra.missionId }, data: { status: 'CREW_READY' } });
      await notify([...crewIds, ...ops], { kind: 'risk.rejected', title: `${ra.mission.missionNo}: risk assessment rejected — revise and resubmit`, link: `/missions/${ra.missionId}/risk`, email: true }, tx);
    } else {
      const approvals = await tx.riskApproval.findMany({ where: { riskAssessmentId: ra.id } });
      if (approvals.every((a) => a.decision === 'APPROVE' || a.decision === 'APPROVE_WITH_REMARKS')) {
        outcome = 'cleared';
        await tx.riskAssessment.update({ where: { id: ra.id }, data: { status: 'CLEARED' } });
        await tx.mission.update({ where: { id: ra.missionId }, data: { status: 'CLEARED' } });
        await notify([...crewIds, ...ops], { kind: 'risk.cleared', title: `${ra.mission.missionNo}: cleared to fly`, link: `/missions/${ra.missionId}` }, tx);
      } else {
        await notify(crewIds, { kind: 'risk.decision', title: `${ra.mission.missionNo}: ${args.role.replace(/_/g, ' ').toLowerCase()} decided` , link: `/missions/${ra.missionId}` }, tx);
      }
    }
    await audit(args.userId, `risk.${args.decision.toLowerCase()}`, 'risk_assessment', ra.id, { after: { role: args.role, remarks: args.remarks } }, tx);
    return { outcome };
  });
}
