import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api';
import { safetyStatusSchema } from '@/lib/validators';
import { audit } from '@/lib/audit';

export const PATCH = route({ perm: 'safety.manage', schema: safetyStatusSchema }, async ({ auth, params, body }) => {
  const before = await db.safetyReport.findUnique({ where: { id: params.id } });
  if (!before) throw notFound('Report');
  const after = await db.safetyReport.update({ where: { id: params.id }, data: { status: body.status } });
  await audit(auth.user.id, 'safety.status', 'safety_report', params.id, { before, after });
  return after;
});
