import { db } from '@/lib/db';
import { route } from '@/lib/api';
import { pushConfigured, webPushPublicKey } from '@/lib/push';

// What the phone-notification switch on My profile needs: the Web Push key and my devices.
export const GET = route({}, async ({ auth }) => {
  const devices = await db.pushDevice.findMany({
    where: { userId: auth.user.id },
    select: { id: true, platform: true, label: true, createdAt: true, lastUsedAt: true, endpoint: true },
    orderBy: { createdAt: 'desc' },
  });
  return { webKey: webPushPublicKey(), configured: pushConfigured(), devices };
});
