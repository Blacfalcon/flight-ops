import { route } from '@/lib/api';
import { readinessSchema } from '@/lib/validators';
import { respondReadiness } from '@/lib/services/missions';

export const POST = route({ perm: 'readiness.respond', schema: readinessSchema }, async ({ auth, params, body }) => {
  return respondReadiness(params.id, auth.user.id, body.ready, body.reason);
});
