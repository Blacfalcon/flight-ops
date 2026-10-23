import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { ORDER_STATUS_LABEL, PRIORITY_LABEL, missionTypeLabel } from '@/lib/constants';
import { formatShortDate, localTime } from '@/lib/time';
import { Card, Empty, MissionStatusPill, PageHeader } from '@/components/ui';

export const metadata = { title: 'Mission Orders' };

const TABS = [
  { key: 'SUBMITTED', label: 'Awaiting approval' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Returned' },
  { key: 'ALL', label: 'All' },
] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage();
  const sp = await searchParams;
  const seesAll = auth.perms.has('order.view');
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as (typeof TABS)[number]['key']) : seesAll ? 'SUBMITTED' : 'APPROVED';

  const orders = await db.missionOrder.findMany({
    where: seesAll
      ? tab === 'ALL'
        ? {}
        : { status: tab }
      : { status: 'APPROVED', mission: { publishedAt: { not: null }, crew: { some: { userId: auth.user.id } } } },
    include: { mission: { select: { id: true, missionNo: true, name: true, type: true, takeoffAt: true, landingAt: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Mission Orders"
        sub={
          seesAll
            ? 'Every sortie has an order. It is raised with the sortie on the schedule, approved by CO Flying Wing or the Commander, then published by the Operations Officer.'
            : 'Orders for missions you are crewed on.'
        }
        actions={
          auth.perms.has('mission.createTraining') ? (
            <a href="/schedule/new" className="btn-primary">
              New sortie and order
            </a>
          ) : undefined
        }
      />
      {seesAll && (
        <nav className="flex flex-wrap gap-2" aria-label="Filter">
          {TABS.map((t) => (
            <a key={t.key} href={`/mission-orders?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined} className={tab === t.key ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>
              {t.label}
            </a>
          ))}
        </nav>
      )}
      <Card bodyClass="">
        {orders.length === 0 ? (
          <Empty>No mission orders here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Mission</th>
                  <th>Take-off</th>
                  <th>Priority</th>
                  <th>Order status</th>
                  <th>Mission status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <a href={`/mission-orders/${o.id}`} className="mono no-underline">
                        {o.orderNo}
                      </a>
                      <div className="max-w-xs truncate text-ink-muted">{o.taskDescription}</div>
                    </td>
                    <td>
                      <a href={`/missions/${o.mission.id}`} className="mono">
                        {o.mission.missionNo}
                      </a>
                      <div className="text-ink-muted">
                        {missionTypeLabel(o.mission.type)} · {o.mission.name}
                      </div>
                    </td>
                    <td>
                      {formatShortDate(o.mission.takeoffAt)} {localTime(o.mission.takeoffAt)}
                    </td>
                    <td>
                      <span className={o.priority === 'IMMEDIATE' ? 'pill-bad' : o.priority === 'PRIORITY' ? 'pill-warn' : 'pill-none'}>{PRIORITY_LABEL[o.priority]}</span>
                    </td>
                    <td>
                      <span className={o.status === 'APPROVED' ? 'pill-good' : o.status === 'REJECTED' ? 'pill-bad' : 'pill-warn'}>{ORDER_STATUS_LABEL[o.status]}</span>
                    </td>
                    <td>
                      <MissionStatusPill status={o.mission.status} takeoffAt={o.mission.takeoffAt} landingAt={o.mission.landingAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
