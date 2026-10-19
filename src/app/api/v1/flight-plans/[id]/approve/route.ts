import { route } from '@/lib/api';
import { approveFlightPlan } from '@/lib/services/flight-plans';

export const POST = route({ perm: 'flightplan.approve' }, async ({ auth, params }) => {
  return approveFlightPlan(params.id, auth.user.id);
});
