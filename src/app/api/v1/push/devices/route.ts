import { z } from 'zod';
import { db } from '@/lib/db';
import { route } from '@/lib/api';
import { audit } from '@/lib/audit';

const addSchema = z.object({
  platform: z.enum(['WEB', 'FCM']),
  endpoint: z.string().min(10).max(1000),
  p256dh: z.string().max(200).optional(),
  auth: z.string().max(100).optional(),
  label: z.string().trim().max(80).optional(),
});

// Register this phone or browser for push. A device belongs to whoever signed in on it last.
export const POST = route({ schema: addSchema }, async ({ auth, body }) => {
  const d = await db.pushDevice.upsert({
    where: { endpoint: body.endpoint },
    create: { userId: auth.user.id, platform: body.platform, endpoint: body.endpoint, p256dh: body.p256dh ?? null, auth: body.auth ?? null, label: body.label ?? null },
    update: { userId: auth.user.id, platform: body.platform, p256dh: body.p256dh ?? null, auth: body.auth ?? null, label: body.label ?? null },
    select: { id: true },
  });
  await audit(auth.user.id, 'push.register', 'push_device', d.id, { after: { platform: body.platform, label: body.label } });
  return d;
});

const removeSchema = z.object({ endpoint: z.string().optional(), id: z.string().uuid().optional() });

// Stop push on a device (switch turned off, signing out, or removing an old phone).
export const DELETE = route({ schema: removeSchema }, async ({ auth, body }) => {
  const r = await db.pushDevice.deleteMany({
    where: { userId: auth.user.id, ...(body.id ? { id: body.id } : { endpoint: body.endpoint ?? '__none__' }) },
  });
  return { removed: r.count };
});
