import { route } from '@/lib/api';
import { listRisk } from '@/lib/services/risk-queries';

export const GET = route({ perm: 'risk.view' }, async ({ query }) => {
  const status = query.get('status') ?? 'SUBMITTED';
  return listRisk(status === 'ALL' ? undefined : status);
});
