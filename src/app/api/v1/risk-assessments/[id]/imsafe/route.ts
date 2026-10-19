import { route } from '@/lib/api';
import { imsafeSchema } from '@/lib/validators';
import { submitImsafe } from '@/lib/services/risk';

export const PUT = route({ perm: 'risk.submit', schema: imsafeSchema }, async ({ auth, params, body }) => {
  return submitImsafe(params.id, auth.user.id, body);
});
