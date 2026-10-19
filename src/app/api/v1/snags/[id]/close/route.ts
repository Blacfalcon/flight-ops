import { db } from '@/lib/db';
import { conflict, notFound, route } from '@/lib/api';
import { closeSnagSchema } from '@/lib/validators';
import { audit } from '@/lib/audit';

export const POST = route({ perm: 'snag.close', schema: closeSnagSchema }, async ({ auth, params, body }) => {
  const s = await db.snag.findUnique({ where: { id: params.id } });
  if (!s) throw notFound('Snag');
  if (s.status === 'CLOSED') throw conflict('This snag is already closed.');
  const after = await db.snag.update({ where: { id: s.id }, data: { status: 'CLOSED', closedById: auth.user.id, closedAt: new Date(), actionTaken: body.actionTaken } });
  await audit(auth.user.id, 'snag.close', 'snag', s.id, { before: s, after });
  return after;
});
