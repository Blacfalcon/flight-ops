import { safetyDashboard } from '@/lib/dashboards';
import { ApprovalSummary } from '../approval-card';
import { Card, Empty, Kpi } from '../ui';
import { formatShortDate } from '@/lib/time';
import { personName } from '@/lib/constants';

export async function SafetyDashboard() {
  const d = await safetyDashboard();
  return (
    <>
      <h1>Safety</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
        <Kpi label="Low (30 days)" value={<span className="text-good-fg">{d.last30.low}</span>} />
        <Kpi label="Medium (30 days)" value={<span className="text-warn-fg">{d.last30.medium}</span>} />
        <Kpi label="High (30 days)" value={<span className="text-bad-fg">{d.last30.high}</span>} />
        <Kpi label="Rejected (30 days)" value={d.last30.rejected} />
        <Kpi label="Open hazard and incident reports" value={d.reports.length} />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[1_1_420px]" title="Risk Assessments Awaiting Decision" actions={<a href="/risk" className="text-[13px] font-semibold">All</a>}>
          {d.pending.length === 0 ? (
            <Empty>None waiting.</Empty>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {d.pending.map((ra) => (
                <div key={ra.id} className="py-4 first:pt-0">
                  <ApprovalSummary ra={ra} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="min-w-0 flex-[1_1_380px]" title="Open Hazard and Incident Reports" actions={<a href="/safety" className="text-[13px] font-semibold">Manage</a>} bodyClass="">
          {d.reports.length === 0 ? (
            <Empty>No open reports.</Empty>
          ) : (
            d.reports.map((r) => (
              <div key={r.id} className="border-t border-[#EEF1F5] px-5 py-3 first:border-0">
                <div className="flex items-center gap-2">
                  <span className={r.kind === 'INCIDENT' ? 'pill-bad' : 'pill-warn'}>{r.kind === 'INCIDENT' ? 'Incident' : 'Hazard'}</span>
                  <span className="font-medium">{r.description.slice(0, 120)}</span>
                </div>
                <div className="text-[12px] text-ink-muted">
                  {personName(r.reportedBy)} · {formatShortDate(r.createdAt)}
                  {r.aircraft ? ` · ${r.aircraft.registration}` : ''}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
