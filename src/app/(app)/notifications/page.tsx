import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/time';
import { Card, Empty, PageHeader } from '@/components/ui';
import { MarkAllRead } from '@/components/mark-all-read';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const auth = await requirePage();
  const items = await db.notification.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  const unread = items.filter((n) => !n.readAt).map((n) => n.id);
  return (
    <>
      <PageHeader title="Notifications" actions={unread.length ? <MarkAllRead /> : undefined} />
      <Card bodyClass="">
        {items.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          items.map((n) => (
            <a
              key={n.id}
              href={n.link ? `${n.link}${n.link.includes('?') ? '&' : '?'}n=${n.id}` : '#'}
              className={`flex items-start justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3.5 text-ink no-underline first:border-0 hover:bg-ground ${n.readAt ? '' : 'bg-brand-soft/60'}`}
            >
              <span>
                <span className={`block ${n.readAt ? '' : 'font-semibold'}`}>{n.title}</span>
                {n.body && <span className="block text-[13px] text-ink-muted">{n.body}</span>}
              </span>
              <span className="whitespace-nowrap text-[12px] text-ink-muted">{formatDateTime(n.createdAt)}</span>
            </a>
          ))
        )}
      </Card>
    </>
  );
}
