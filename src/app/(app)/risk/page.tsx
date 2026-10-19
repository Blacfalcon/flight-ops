import { requirePage } from '@/lib/auth/guard';
import { listRisk } from '@/lib/services/risk-queries';
import { approverRolesFor } from '@/lib/rbac';
import { formatShortDate, localTime } from '@/lib/time';
import { ApprovalSummary } from '@/components/approval-card';
import { Card, Empty, PageHeader, RiskPill } from '@/components/ui';

export const metadata = { title: 'Risk approvals' };

const TABS = [
  { key: 'SUBMITTED', label: 'Awaiting decision' },
  { key: 'CLEARED', label: 'Cleared' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'ALL', label: 'All' },
];

export default async function RiskQueuePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage('risk.view');
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : 'SUBMITTED';
  const items = await listRisk(tab === 'ALL' ? undefined : tab);
  const myRoles = approverRolesFor(auth.roles);
  const mine = tab === 'SUBMITTED' ? items.filter((ra) => ra.approvals.some((a) => !a.decision && myRoles.includes(a.approverRole))) : [];
  const others = tab === 'SUBMITTED' ? items.filter((ra) => !mine.includes(ra)) : items;

  return (
    <>
      <PageHeader title="Risk approvals" sub="Risk assessments go to every required approver at once." />
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <a key={t.key} href={`/risk?status=${t.key}`} aria-current={tab === t.key ? 'page' : undefined} className={`rounded-full px-4 py-2 text-[13px] font-semibold no-underline ${tab === t.key ? 'bg-navy text-white' : 'bg-white text-ink'}`}>
            {t.label}
          </a>
        ))}
      </nav>

      {tab === 'SUBMITTED' && (
        <Card title={`Waiting for you (${mine.length})`}>
          {mine.length === 0 ? (
            <Empty>Nothing needs your decision.</Empty>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6">
              {mine.map((ra) => (
                <div key={ra.id} className="rounded-xl border border-line p-4">
                  <ApprovalSummary ra={ra} />
                  <a href={`/risk/${ra.id}`} className="btn-primary mt-4 w-full">
                    Review and decide
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card title={tab === 'SUBMITTED' ? 'Waiting for others' : TABS.find((t) => t.key === tab)!.label} bodyClass="">
        {others.length === 0 ? (
          <Empty>None.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Take-off</th>
                  <th>Risk</th>
                  <th>Approvals</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {others.map((ra) => (
                  <tr key={ra.id}>
                    <td>
                      <a href={`/risk/${ra.id}`} className="mono no-underline">
                        {ra.mission.missionNo}
                      </a>
                      <div className="text-ink-muted">{ra.mission.name}</div>
                    </td>
                    <td>
                      {formatShortDate(ra.mission.takeoffAt)} {localTime(ra.mission.takeoffAt)}
                    </td>
                    <td>
                      <RiskPill level={ra.level} score={ra.totalScore} />
                    </td>
                    <td>
                      {ra.approvals.filter((a) => a.decision && a.decision !== 'REJECT').length}/{ra.approvals.length}
                      {ra.approvals.some((a) => a.decision === 'REJECT') && <span className="pill-bad ml-2">Rejected</span>}
                    </td>
                    <td>v{ra.version}</td>
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
