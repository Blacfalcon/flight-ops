import { Prisma, type AircraftStatus } from '@prisma/client';
import { db } from '../db';
import { notFound } from '../api-errors';
import { audit } from '../audit';
import { onAircraftConfirmed, onAircraftUnavailable } from './missions';
import { addDays, dateOnly, localDate } from '../time';

export type AircraftUpdate = Partial<{
  registration: string;
  type: string;
  status: AircraftStatus;
  flyingHours: number;
  hoursToNextInspection: number;
  inspectionIntervalHours: number;
  inspectionIntervalDays: number | null;
  lastInspectionDate: string | null;
  nextInspectionDue: string | null;
  maintenanceRemarks: string | null;
  active: boolean;
}>;

export async function updateAircraft(id: string, patch: AircraftUpdate, actorId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.aircraft.findUnique({ where: { id } });
    if (!before) throw notFound('Aircraft');
    const data: Prisma.AircraftUpdateInput = {
      registration: patch.registration?.trim().toUpperCase(),
      type: patch.type?.trim(),
      status: patch.status,
      flyingHours: patch.flyingHours,
      hoursToNextInspection: patch.hoursToNextInspection,
      inspectionIntervalHours: patch.inspectionIntervalHours,
      inspectionIntervalDays: patch.inspectionIntervalDays,
      lastInspectionDate: patch.lastInspectionDate === undefined ? undefined : patch.lastInspectionDate ? dateOnly(patch.lastInspectionDate) : null,
      nextInspectionDue: patch.nextInspectionDue === undefined ? undefined : patch.nextInspectionDue ? dateOnly(patch.nextInspectionDue) : null,
      maintenanceRemarks: patch.maintenanceRemarks,
      active: patch.active,
    };
    const after = await tx.aircraft.update({ where: { id }, data });
    await recordHistory(tx, after.id, after.status, after.flyingHours, after.hoursToNextInspection, patch.maintenanceRemarks ?? null, actorId);
    if (before.status === 'SERVICEABLE' && after.status !== 'SERVICEABLE') await onAircraftUnavailable(tx, id, actorId);
    await audit(actorId, 'aircraft.update', 'aircraft', id, { before, after }, tx);
    return after;
  });
}

/** An inspection was carried out today: reset the counters from the aircraft's own intervals. */
export async function completeInspection(id: string, actorId: string, remarks?: string) {
  return db.$transaction(async (tx) => {
    const a = await tx.aircraft.findUnique({ where: { id } });
    if (!a) throw notFound('Aircraft');
    const today = localDate();
    const after = await tx.aircraft.update({
      where: { id },
      data: {
        status: 'SERVICEABLE',
        hoursToNextInspection: a.inspectionIntervalHours,
        lastInspectionDate: dateOnly(today),
        nextInspectionDue: a.inspectionIntervalDays ? dateOnly(addDays(today, a.inspectionIntervalDays)) : null,
        maintenanceRemarks: remarks ?? a.maintenanceRemarks,
      },
    });
    await recordHistory(tx, id, after.status, after.flyingHours, after.hoursToNextInspection, remarks ?? 'Inspection completed', actorId);
    await audit(actorId, 'aircraft.inspectionCompleted', 'aircraft', id, { before: a, after }, tx);
    return after;
  });
}

async function recordHistory(
  tx: Prisma.TransactionClient,
  aircraftId: string,
  status: AircraftStatus,
  flyingHours: Prisma.Decimal,
  hoursToNextInspection: Prisma.Decimal,
  remarks: string | null,
  actorId: string,
) {
  await tx.aircraftStatusHistory.create({ data: { aircraftId, status, flyingHours, hoursToNextInspection, remarks, changedById: actorId } });
}

/** CO Engineering's daily confirmation for a flying date. Also sets each aircraft's current status. */
export async function confirmServiceability(
  date: string,
  entries: Array<{ aircraftId: string; status: AircraftStatus; remarks?: string; hoursToNextInspection?: number }>,
  actorId: string,
) {
  return db.$transaction(async (tx) => {
    const results: Array<{ id: string }> = [];
    for (const e of entries) {
      const before = await tx.aircraft.findUnique({ where: { id: e.aircraftId } });
      if (!before) throw notFound('Aircraft');
      const check = await tx.serviceabilityCheck.upsert({
        where: { aircraftId_flyingDate: { aircraftId: e.aircraftId, flyingDate: dateOnly(date) } },
        create: { aircraftId: e.aircraftId, flyingDate: dateOnly(date), status: e.status, remarks: e.remarks ?? null, confirmedById: actorId },
        update: { status: e.status, remarks: e.remarks ?? null, confirmedById: actorId },
      });
      const after = await tx.aircraft.update({
        where: { id: e.aircraftId },
        data: {
          status: e.status,
          ...(e.hoursToNextInspection !== undefined ? { hoursToNextInspection: e.hoursToNextInspection } : {}),
          ...(e.remarks !== undefined ? { maintenanceRemarks: e.remarks } : {}),
        },
      });
      if (before.status !== after.status || e.hoursToNextInspection !== undefined) {
        await recordHistory(tx, after.id, after.status, after.flyingHours, after.hoursToNextInspection, e.remarks ?? null, actorId);
      }
      if (e.status === 'SERVICEABLE') await onAircraftConfirmed(tx, e.aircraftId, date);
      else await onAircraftUnavailable(tx, e.aircraftId, actorId);
      results.push(check);
    }
    await audit(actorId, 'serviceability.confirm', 'serviceability_check', null, { after: { date, entries } }, tx);
    return results;
  });
}
