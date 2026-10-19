import { route } from '@/lib/api';
import { decisionSchema } from '@/lib/validators';
import { decideRisk } from '@/lib/services/risk';
import { approverRolesFor } from '@/lib/rbac';

export const POST = route({ perm: 'risk.approve', schema: decisionSchema }, async ({ auth, params, body }) => {
  return decideRisk({
    riskId: params.id,
    userId: auth.user.id,
    appointment: auth.user.appointment,
    myApproverRoles: approverRolesFor(auth.roles),
    role: body.role,
    decision: body.decision,
    remarks: body.remarks,
  });
});
