import { db } from '../../lib/db';
import { pushToUser } from '../../lib/push';
import { getSettings } from '../../lib/settings';

/**
 * Every in-app notification also goes to the person's phones within a minute.
 * Several items at once are combined into one phone notification.
 */
export async function sendPendingPushes() {
  const pending = await db.notification.findMany({
    where: { pushedAt: null, createdAt: { gt: new Date(Date.now() - 6 * 3_600_000) } },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  if (!pending.length) return;
  const { unit } = await getSettings();

  const byUser = new Map<string, typeof pending>();
  for (const n of pending) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);

  for (const [userId, items] of byUser) {
    try {
      if (items.length > 3) {
        await pushToUser(userId, { title: `${items.length} new items`, body: items.slice(-2).map((n) => n.title).join(' · '), link: '/notifications', tag: 'summary' }, unit.short);
      } else {
        for (const n of items) {
          const sep = n.link?.includes('?') ? '&' : '?';
          await pushToUser(userId, { title: n.title, body: n.body ?? undefined, link: n.link ? `${n.link}${sep}n=${n.id}` : '/notifications', tag: n.kind }, unit.short);
        }
      }
    } finally {
      await db.notification.updateMany({ where: { id: { in: items.map((n) => n.id) } }, data: { pushedAt: new Date() } });
    }
  }
  // Older items that were never pushed (worker was down): mark them so they are not sent late
  await db.notification.updateMany({ where: { pushedAt: null, createdAt: { lte: new Date(Date.now() - 6 * 3_600_000) } }, data: { pushedAt: new Date() } });
}
