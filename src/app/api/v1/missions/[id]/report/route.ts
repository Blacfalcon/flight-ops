import { route } from '@/lib/api';
import { missionReportSchema } from '@/lib/validators';
import { submitMissionReport } from '@/lib/services/closeout';

export const POST = route({ perm: 'report.submit', schema: missionReportSchema }, async ({ auth, params, body }) => {
  return submitMissionReport(params.id, auth.user.id, body);
});
