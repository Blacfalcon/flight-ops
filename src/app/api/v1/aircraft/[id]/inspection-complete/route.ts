import { z } from 'zod';
import { route } from '@/lib/api';
import { completeInspection } from '@/lib/services/aircraft';

const schema = z.object({ remarks: z.string().trim().max(1000).optional() });

export const POST = route({ perm: 'aircraft.update', schema }, async ({ auth, params, body }) => {
  return completeInspection(params.id, auth.user.id, body.remarks);
});
