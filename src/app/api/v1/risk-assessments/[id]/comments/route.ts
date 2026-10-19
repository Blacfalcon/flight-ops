import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api';
import { commentSchema } from '@/lib/validators';
import { nameOnly } from '@/lib/selects';
import { notify } from '@/lib/notify';
import { audit } from '@/lib/audit';

export const GET = route({ perm: 'risk.view' }, async ({ params }) => {
  return db.comment.findMany({
    where: { entityType: 'risk_assessment', entityId: params.id },
    include: { author: { select: nameOnly } },
    orderBy: { createdAt: 'asc' },
  });
});

export const POST = route({ perm: 'risk.comment', schema: commentSchema }, async ({ auth, params, body }) => {
  const ra = await db.riskAssessment.findUnique({ where: { id: params.id }, include: { mission: { include: { crew: true } }, approvals: true } });
  if (!ra) throw notFound('Risk assessment');
  const c = await db.comment.create({ data: { entityType: 'risk_assessment', entityId: ra.id, authorId: auth.user.id, body: body.body } });
  const deciders = ra.approvals.map((a) => a.approverId).filter((x): x is string => !!x);
  await notify([...ra.mission.crew.map((m) => m.userId), ...deciders].filter((id) => id !== auth.user.id), { kind: 'risk.comment', title: `${ra.mission.missionNo}: new comment on the risk assessment`, link: `/risk/${ra.id}` });
  await audit(auth.user.id, 'risk.comment', 'risk_assessment', ra.id, { after: { body: body.body } });
  return c;
});
