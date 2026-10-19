import { db } from '@/lib/db';
import { forbidden, notFound, route } from '@/lib/api';
import { riskSubmitSchema } from '@/lib/validators';
import { submitRisk, weatherSuggestion } from '@/lib/services/risk';

// GET: what the risk form needs before it opens (the weather suggestion from the latest METAR)
export const GET = route({}, async ({ auth, params }) => {
  const m = await db.mission.findUnique({ where: { id: params.id }, include: { crew: true } });
  if (!m) throw notFound('Mission');
  if (!auth.perms.has('risk.view') && !m.crew.some((c) => c.userId === auth.user.id)) throw forbidden();
  return { weather: await weatherSuggestion(m.takeoffAt) };
});

export const POST = route({ perm: 'risk.submit', schema: riskSubmitSchema }, async ({ auth, params, body }) => {
  return submitRisk({ missionId: params.id, userId: auth.user.id, ...body });
});
