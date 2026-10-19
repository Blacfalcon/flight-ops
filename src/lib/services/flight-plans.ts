import type { z } from 'zod';
import { db } from '../db';
import { conflict, forbidden, notFound } from '../api-errors';
import { audit } from '../audit';
import { notify, usersWithAppointments } from '../notify';
import { getSettings } from '../settings';
import { toBoth } from '../fuel';
import type { flightPlanSchema } from '../validators';

type PlanInput = z.infer<typeof flightPlanSchema>;

async function checkMissionLink(missionId: string | null | undefined, userId: string) {
  if (!missionId) return;
  const m = await db.mission.findUnique({ where: { id: missionId }, include: { crew: true } });
  if (!m) throw notFound('Mission');
  if (!m.crew.some((c) => c.userId === userId)) throw forbidden('You can only file a plan for a mission you are crewed on.');
  if (['COMPLETED', 'ABORTED', 'CANCELLED'].includes(m.status)) throw conflict('That mission is closed.');
}

export async function saveFlightPlan(userId: string, input: PlanInput, id?: string) {
  await checkMissionLink(input.missionId, userId);
  const settings = await getSettings();
  const fuel = toBoth(input.fuelRequired, input.fuelUnit, settings.fuelDensityKgPerL);
  const submitting = !!input.submit;
  const data = {
    missionId: input.missionId ?? null,
    departure: input.departure.toUpperCase(),
    destination: input.destination.toUpperCase(),
    route: input.route,
    alternate: input.alternate.toUpperCase(),
    estFlightTimeMin: input.estFlightTimeMin,
    fuelRequiredKg: fuel.kg,
    fuelRequiredL: fuel.l,
    crewNotes: input.crewNotes ?? null,
  };

  let plan;
  if (id) {
    const before = await db.flightPlan.findUnique({ where: { id } });
    if (!before) throw notFound('Flight plan');
    if (before.submittedById !== userId) throw forbidden('You can only change your own flight plans.');
    if (before.status === 'APPROVED') throw conflict('An approved plan cannot be changed. File a new one.');
    plan = await db.flightPlan.update({
      where: { id },
      data: { ...data, status: submitting || before.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT', submittedAt: submitting ? new Date() : before.submittedAt },
    });
    await audit(userId, 'flightPlan.update', 'flight_plan', id, { before, after: plan });
  } else {
    plan = await db.flightPlan.create({
      data: { ...data, submittedById: userId, status: submitting ? 'SUBMITTED' : 'DRAFT', submittedAt: submitting ? new Date() : null },
    });
    await audit(userId, 'flightPlan.create', 'flight_plan', plan.id, { after: plan });
  }
  if (submitting) {
    await notify(await usersWithAppointments(['OPERATIONS_OFFICER']), { kind: 'flightPlan.submitted', title: `Flight plan ${plan.departure} → ${plan.destination} awaiting approval`, link: `/flight-plans/${plan.id}`, email: true });
  }
  return plan;
}

export async function approveFlightPlan(id: string, actorId: string) {
  const plan = await db.flightPlan.findUnique({ where: { id } });
  if (!plan) throw notFound('Flight plan');
  if (plan.status !== 'SUBMITTED') throw conflict('Only a submitted plan can be approved.');
  const after = await db.flightPlan.update({ where: { id }, data: { status: 'APPROVED', approvedById: actorId, approvedAt: new Date() } });
  await notify([plan.submittedById], { kind: 'flightPlan.approved', title: `Your flight plan ${plan.departure} → ${plan.destination} is approved`, link: `/flight-plans/${id}` });
  await audit(actorId, 'flightPlan.approve', 'flight_plan', id, { before: plan, after });
  return after;
}
