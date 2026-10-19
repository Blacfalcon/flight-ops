import { db } from '@/lib/db';
import { route } from '@/lib/api';

export const GET = route({}, async ({ auth, query }) => {
  const unreadOnly = query.get('unread') === '1';
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: auth.user.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, kind: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { userId: auth.user.id, readAt: null } }),
  ]);
  return { items, unread };
});
