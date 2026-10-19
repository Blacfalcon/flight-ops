import { db } from '@/lib/db';
import { forbidden, notFound, route } from '@/lib/api';
import { getObject } from '@/lib/storage';

// Streams an attachment after checking the person may see it. Storage is never exposed directly.
export const GET = route({}, async ({ auth, params }) => {
  const att = await db.attachment.findUnique({ where: { id: params.id } });
  if (!att) throw notFound('File');
  if (att.entityType === 'mission_order') {
    const order = await db.missionOrder.findUnique({ where: { id: att.entityId }, include: { mission: { include: { crew: true } } } });
    if (!order) throw notFound('File');
    const crewed = order.mission.crew.some((c) => c.userId === auth.user.id);
    if (!auth.perms.has('order.view') && !crewed) throw forbidden();
  } else if (!auth.perms.has('summary.view')) {
    throw forbidden();
  }
  const obj = await getObject(att.storageKey);
  return new Response(Buffer.from(obj.body), {
    headers: {
      'Content-Type': att.mimeType,
      'Content-Disposition': `inline; filename="${att.fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, max-age=86400',
    },
  });
});
