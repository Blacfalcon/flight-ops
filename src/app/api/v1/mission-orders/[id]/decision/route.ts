import { route } from '@/lib/api';
import { orderDecisionSchema } from '@/lib/validators';
import { decideOrder } from '@/lib/services/orders';

export const POST = route({ perm: 'order.approve', schema: orderDecisionSchema }, async ({ auth, params, body }) => {
  return decideOrder({ orderId: params.id, userId: auth.user.id, decision: body.decision, remarks: body.remarks });
});
