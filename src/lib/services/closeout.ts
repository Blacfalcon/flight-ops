import { Prisma } from '@prisma/client';
import { db } from '../db';
import { conflict, forbidden, invalid, notFound } from '../api-errors';
import { audit } from '../audit';
import { notify, usersWithAppointments } from '../notify';
import { getSettings } from '../settings';
import { toBoth } from '../fuel';

export type ReportInput = {
  outcome: 'COMPLETED' | 'ABORTED';
  flightTimeMin: number;
  fuelUsed: number;
  fuelUnit: 'kg' | 'l';
  snags: string[];
  remarks: string;
  missionOutcome?: string;
  abortReason?: string;
};

/** Mission Completed / Mission Aborted. Updates aircraft hours and opens snags. */
export async function submitMissionReport(missionId: string, userId: string, input: ReportInput) {
  if (input.outcome === 'COMPLETED' && !input.missionOutcome?.trim()) throw invalid('Describe the mission outcome.', { missionOutcome: 'Required.' });
  if (input.outcome === 'ABORTED' && !input.abortReason?.trim()) throw invalid('Give the abort reason.', { abortReason: 'Required.' });
  if (input.flightTimeMin < 0 || input.flightTimeMin > 24 * 60) throw invalid('Flight time is out of range.', { flightTimeMin: 'Check the value.' });
  if (input.outcome === 'COMPLETED' && input.flightTimeMin === 0) throw invalid('A completed mission needs flight time.', { flightTimeMin: 'Required.' });

  const settings = await getSettings();
  const fuel = toBoth(input.fuelUsed, input.fuelUnit, settings.fuelDensityKgPerL);

  return db.$transaction(async (tx) => {
    const m = await tx.mission.findUnique({ where: { id: missionId }, include: { crew: true, aircraft: true, report: true } });
    if (!m) throw notFound('Mission');
    if (!m.crew.some((c) => c.userId === userId)) throw forbidden('Only the crew can close this mission.');
    if (m.report) throw conflict('This mission already has a report.');
    if (input.outcome === 'COMPLETED' && m.status !== 'CLEARED') throw conflict('Only a mission cleared to fly can be completed.');
    if (input.outcome === 'ABORTED' && !['PUBLISHED', 'CREW_READY', 'RISK_SUBMITTED', 'CLEARED'].includes(m.status)) {
      throw conflict('This mission cannot be aborted in its current state.');
    }

    const report = await tx.missionReport.create({
      data: {
        missionId,
        outcome: input.outcome,
        flightTimeMin: input.flightTimeMin,
        fuelUsedKg: fuel.kg,
        fuelUsedL: fuel.l,
        abortReason: input.abortReason?.trim() || null,
        missionOutcome: input.missionOutcome?.trim() || null,
        remarks: input.remarks.trim(),
        submittedById: userId,
      },
    });

    const snags = input.snags.map((s) => s.trim()).filter(Boolean);
    for (const description of snags) {
      await tx.snag.create({ data: { aircraftId: m.aircraftId, missionReportId: report.id, description, raisedById: userId } });
    }

    await tx.mission.update({ where: { id: missionId }, data: { status: input.outcome } });
    await tx.riskAssessment.updateMany({ where: { missionId, status: 'SUBMITTED' }, data: { status: 'WITHDRAWN' } });

    // Aircraft hours
    if (input.flightTimeMin > 0) {
      const hours = new Prisma.Decimal(input.flightTimeMin).div(60).toDecimalPlaces(2);
      const updated = await tx.aircraft.update({
        where: { id: m.aircraftId },
        data: {
          flyingHours: { increment: hours },
          hoursToNextInspection: { decrement: hours },
        },
      });
      let status = updated.status;
      if (Number(updated.hoursToNextInspection) <= 0 && status === 'SERVICEABLE') {
        status = 'INSPECTION_DUE';
        await tx.aircraft.update({ where: { id: m.aircraftId }, data: { status, hoursToNextInspection: 0 } });
      }
      await tx.aircraftStatusHistory.create({
        data: {
          aircraftId: m.aircraftId,
          status,
          flyingHours: updated.flyingHours,
          hoursToNextInspection: Prisma.Decimal.max(updated.hoursToNextInspection, 0),
          remarks: `${m.missionNo}: +${hours.toString()} h`,
          changedById: userId,
        },
      });
    }

    const staff = await usersWithAppointments(['OPERATIONS_OFFICER', 'CO_FLYING_WING'], tx);
    await notify(staff, { kind: `mission.${input.outcome.toLowerCase()}`, title: `${m.missionNo} ${input.outcome === 'COMPLETED' ? 'completed' : 'aborted'}`, link: `/missions/${missionId}` }, tx);
    if (snags.length) {
      const engr = await usersWithAppointments(['CO_ENGINEERING', 'ENGINEERING_OFFICER'], tx);
      await notify(engr, { kind: 'snag.raised', title: `${snags.length} snag(s) raised on ${m.aircraft.registration}`, link: '/engineering/snags', email: true }, tx);
    }
    await audit(userId, `mission.${input.outcome.toLowerCase()}`, 'mission', missionId, { after: { ...input, fuel } }, tx);
    return report;
  });
}
