import { forbidden, notFound, route } from '@/lib/api';
import { loadRisk } from '@/lib/services/risk-queries';

export const GET = route({}, async ({ auth, params }) => {
  const ra = await loadRisk(params.id);
  if (!ra) throw notFound('Risk assessment');
  if (!auth.perms.has('risk.view') && !ra.mission.crew.some((c) => c.userId === auth.user.id)) throw forbidden();
  return ra;
});
