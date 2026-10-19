import { route } from '@/lib/api';
import { cancelSchema } from '@/lib/validators';
import { cancelMission } from '@/lib/services/missions';

export const POST = route({ perm: 'mission.cancel', schema: cancelSchema }, async ({ auth, params, body }) => {
  await cancelMission(params.id, body.reason, auth.user.id);
  return { ok: true };
});
