import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { ApiError, forbidden, invalid, route } from '@/lib/api';
import type { AuthContext } from '@/lib/auth/session';
import type { Permission } from '@/lib/rbac';
import {
  flightPlanSchema,
  imsafeSchema,
  missionReportSchema,
  readinessSchema,
  riskSubmitSchema,
  safetyReportSchema,
  snagSchema,
  syncSchema,
} from '@/lib/validators';
import { respondReadiness } from '@/lib/services/missions';
import { submitImsafe, submitRisk } from '@/lib/services/risk';
import { submitMissionReport } from '@/lib/services/closeout';
import { saveFlightPlan } from '@/lib/services/flight-plans';
import { notify, usersWithAppointments } from '@/lib/notify';
import { audit } from '@/lib/audit';

/**
 * Offline outbox upload. Each item carries a unique clientOpId; an item already processed returns its
 * stored result instead of running twice. Items are processed in order and each succeeds or fails alone.
 */
type Op = { clientOpId: string; type: string; target?: string; payload: unknown; createdAt: string };

const NEEDS: Record<string, Permission> = {
  readiness: 'readiness.respond',
  'risk.submit': 'risk.submit',
  imsafe: 'risk.submit',
  'flightplan.save': 'flightplan.create',
  'report.submit': 'report.submit',
  'snag.raise': 'snag.raise',
  'safety.raise': 'safety.raise',
};

async function run(op: Op, auth: AuthContext): Promise<unknown> {
  const need = NEEDS[op.type];
  if (!need || !auth.perms.has(need)) throw forbidden();
  const target = op.target ?? '';
  switch (op.type) {
    case 'readiness': {
      const b = readinessSchema.parse(op.payload);
      return respondReadiness(target, auth.user.id, b.ready, b.reason);
    }
    case 'risk.submit': {
      const b = riskSubmitSchema.parse(op.payload);
      const ra = await submitRisk({ missionId: target, userId: auth.user.id, ...b });
      return { id: ra.id };
    }
    case 'imsafe': {
      const b = imsafeSchema.parse(op.payload);
      return submitImsafe(target, auth.user.id, b);
    }
    case 'flightplan.save': {
      const b = flightPlanSchema.parse(op.payload);
      const p = await saveFlightPlan(auth.user.id, b, target || undefined);
      return { id: p.id };
    }
    case 'report.submit': {
      const b = missionReportSchema.parse(op.payload);
      const r = await submitMissionReport(target, auth.user.id, b);
      return { id: r.id };
    }
    case 'snag.raise': {
      const b = snagSchema.parse(op.payload);
      const s = await db.snag.create({ data: { aircraftId: b.aircraftId, description: b.description, raisedById: auth.user.id } });
      await notify(await usersWithAppointments(['CO_ENGINEERING', 'ENGINEERING_OFFICER']), { kind: 'snag.raised', title: 'A snag has been raised', link: '/engineering/snags', email: true });
      await audit(auth.user.id, 'snag.raise', 'snag', s.id, { after: s });
      return { id: s.id };
    }
    case 'safety.raise': {
      const b = safetyReportSchema.parse(op.payload);
      const r = await db.safetyReport.create({ data: { ...b, aircraftId: b.aircraftId ?? null, missionId: b.missionId ?? null, reportedById: auth.user.id } });
      await notify(await usersWithAppointments(['SAFETY_OFFICER']), { kind: 'safety.raised', title: `New ${b.kind.toLowerCase()} report`, link: '/safety', email: true });
      await audit(auth.user.id, 'safety.raise', 'safety_report', r.id, { after: r });
      return { id: r.id };
    }
  }
  throw invalid('Unknown item type.');
}

export const POST = route({ schema: syncSchema }, async ({ auth, body }) => {
  const results: Array<{ clientOpId: string; ok: boolean; result?: unknown; error?: { code: string; message: string; fields?: Record<string, string> } }> = [];
  for (const op of body.ops) {
    const done = await db.syncReceipt.findUnique({ where: { clientOpId: op.clientOpId } });
    if (done) {
      results.push({ clientOpId: op.clientOpId, ...(done.result as object) } as never);
      continue;
    }
    let entry: (typeof results)[number];
    try {
      const result = await run(op as Op, auth);
      entry = { clientOpId: op.clientOpId, ok: true, result };
    } catch (err) {
      if (err instanceof ApiError) entry = { clientOpId: op.clientOpId, ok: false, error: { code: err.code, message: err.message, fields: err.fields } };
      else if (err && typeof err === 'object' && 'issues' in err) entry = { clientOpId: op.clientOpId, ok: false, error: { code: 'invalid', message: 'Some fields need attention.' } };
      else {
        console.error('sync item failed', err);
        results.push({ clientOpId: op.clientOpId, ok: false, error: { code: 'server_error', message: 'Could not save; will retry.' } });
        continue; // not recorded, so the device retries
      }
    }
    results.push(entry);
    try {
      const { clientOpId, ...stored } = entry;
      await db.syncReceipt.create({ data: { clientOpId, userId: auth.user.id, result: stored as Prisma.InputJsonValue } });
    } catch {
      // A parallel upload already recorded it
    }
  }
  return { results };
});
