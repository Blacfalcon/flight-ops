import { z } from 'zod';
import { db } from '@/lib/db';
import { route } from '@/lib/api';

const schema = z.object({ ids: z.array(z.string().uuid()).max(200).optional(), all: z.boolean().optional() });

export const POST = route({ schema }, async ({ auth, body }) => {
  await db.notification.updateMany({
    where: { userId: auth.user.id, readAt: null, ...(body.all ? {} : { id: { in: body.ids ?? [] } }) },
    data: { readAt: new Date() },
  });
  return { ok: true };
});
