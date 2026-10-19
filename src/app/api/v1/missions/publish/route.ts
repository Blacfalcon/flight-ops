import { route } from '@/lib/api';
import { publishSchema } from '@/lib/validators';
import { publishMissions } from '@/lib/services/missions';

// Only the Operations Officer publishes, and only sorties whose mission order is approved.
export const POST = route({ perm: 'mission.publish', schema: publishSchema }, async ({ auth, body }) => {
  return publishMissions(body.ids, auth.user.id);
});
