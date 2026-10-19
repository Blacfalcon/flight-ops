import { db } from '@/lib/db';
import { invalid, route } from '@/lib/api';
import { serviceabilitySchema, localDateStr } from '@/lib/validators';
import { confirmServiceability } from '@/lib/services/aircraft';
import { dateOnly } from '@/lib/time';
import { nameOnly } from '@/lib/selects';

function dateParam(raw: string) {
  const r = localDateStr.safeParse(raw);
  if (!r.success) throw invalid('Use a date like 2026-10-16.');
  return r.data;
}

export const GET = route({ perm: 'serviceability.view' }, async ({ params }) => {
  const date = dateParam(params.date);
  const [aircraft, checks] = await Promise.all([
    db.aircraft.findMany({ where: { active: true }, orderBy: { registration: 'asc' } }),
    db.serviceabilityCheck.findMany({ where: { flyingDate: dateOnly(date) }, include: { confirmedBy: { select: nameOnly } } }),
  ]);
  return {
    date,
    items: aircraft.map((a) => ({ aircraft: a, check: checks.find((c) => c.aircraftId === a.id) ?? null })),
    complete: aircraft.length > 0 && aircraft.every((a) => checks.some((c) => c.aircraftId === a.id)),
  };
});

export const POST = route({ perm: 'serviceability.confirm', schema: serviceabilitySchema }, async ({ auth, params, body }) => {
  const date = dateParam(params.date);
  const checks = await confirmServiceability(date, body.entries, auth.user.id);
  return { confirmed: checks.length };
});
