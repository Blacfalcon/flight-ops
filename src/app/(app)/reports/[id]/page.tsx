import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import type { SummaryFigures } from '@/lib/reports/summary';
import { missionTypeLabel } from '@/lib/constants';
import { formatDateTime, formatShortDate } from '@/lib/time';
import { Card, Empty, Kpi, PageHeader } from '@/components/ui';
import { formatHours } from '@/lib/hours';

const LABEL: Record<string, string> = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly' };
const pct = (n: number | null) => (n === null ? '—' : `${n}%`);

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePage('summary.view');
  const { id } = await params;
  const r = await db.summaryReport.findUnique({ where: { id } });
  if (!r) notFound();
  const f = r.figures as unknown as SummaryFigures;
  const maxHours = Math.max(1, ...f.perDay.map((d) => d.hours));
  const range = f.start === f.end ? formatShortDate(f.start) : `${formatShortDate(f.start)} – ${formatShortDate(f.end)}`;

  return (
    <>
      <PageHeader
        back={{ href: '/reports', label: 'Reports' }}
        title={`${LABEL[f.period]} summary`}
        sub={`${range} · generated ${formatDateTime(r.generatedAt)}`}
        actions={
          auth.perms.has('summary.export') ? (
            <>
              <a href={`/api/v1/reports/${r.id}/export?format=pdf`} className="btn-secondary">
                Export PDF
              </a>
              <a href={`/api/v1/reports/${r.id}/export?format=xlsx`} className="btn-secondary">
                Export Excel
              </a>
            </>
          ) : auth.perms.has('summary.exportSafety') ? (
            <a href={`/api/v1/reports/${r.id}/export?format=pdf&part=safety`} className="btn-secondary">
              Export safety extract (PDF)
            </a>
          ) : undefined
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
        <Kpi label="Total missions" value={f.totals.missions} sub={`${f.totals.cancelled} cancelled`} />
        <Kpi label="Completed" value={<span className="text-good-fg">{f.totals.completed}</span>} sub={`Success rate ${pct(f.totals.successRate)}`} />
        <Kpi label="Aborted" value={<span className="text-bad-fg">{f.totals.aborted}</span>} />
        <Kpi label="Flight hours" value={formatHours(f.totals.flightHours)} />
        <Kpi label="Fuel used" value={`${f.totals.fuelKg} kg`} sub={`${f.totals.fuelL} L`} />
        <Kpi label="Open snags" value={f.totals.openSnags} sub="at generation" />
      </div>

      {f.perDay.length > 1 && (
        <Card title="Flight hours by day">
          <div className="flex h-48 items-end gap-1.5" role="img" aria-label="Flight hours per day">
            {f.perDay.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${formatHours(d.hours)}, ${d.missions} missions`}>
                <span className="text-[11px] text-ink-muted">{d.hours ? formatHours(d.hours) : ''}</span>
                <div className="w-full rounded-t bg-brand" style={{ height: `${(d.hours / maxHours) * 100}%`, minHeight: d.hours ? 3 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5 text-[10px] text-ink-muted">
            {f.perDay.map((d, i) => (
              <span key={d.date} className="flex-1 text-center">
                {f.perDay.length <= 14 || i % 7 === 0 ? d.date.slice(8) : ''}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[1_1_380px]" title="Aircraft utilisation" bodyClass="">
          {f.aircraft.length === 0 ? (
            <Empty>No flying recorded.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Aircraft</th>
                  <th>Sorties</th>
                  <th>Hours</th>
                  <th>Days unserviceable</th>
                </tr>
              </thead>
              <tbody>
                {f.aircraft.map((a) => (
                  <tr key={a.registration}>
                    <td className="mono">{a.registration}</td>
                    <td>{a.sorties}</td>
                    <td>{formatHours(a.hours)}</td>
                    <td>{a.daysUnserviceable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="min-w-0 flex-[1_1_380px]" title="Mission types" bodyClass="">
          {f.byType.length === 0 ? (
            <Empty>No missions.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Missions</th>
                  <th>Completed</th>
                  <th>Aborted</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {f.byType.map((t) => (
                  <tr key={t.type}>
                    <td>{missionTypeLabel(t.type)}</td>
                    <td>{t.missions}</td>
                    <td>{t.completed}</td>
                    <td>{t.aborted}</td>
                    <td>{formatHours(t.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {f.abortReasons.length > 0 && (
        <Card title="Abort reasons" bodyClass="">
          <table className="table">
            <tbody>
              {f.abortReasons.map((a) => (
                <tr key={a.reason}>
                  <td>{a.reason}</td>
                  <td className="w-16 text-right">{a.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {(f.period === 'MONTHLY' || f.period === 'QUARTERLY' || f.period === 'WEEKLY') && (
        <Card title="Personnel" actions={<span className="text-[13px] text-ink-muted">Readiness rate {pct(f.personnel.readinessRate)} · {f.personnel.notAvailable} not available</span>} bodyClass="">
          {f.personnel.pilots.length === 0 ? (
            <Empty>No flying recorded.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pilot</th>
                    <th>Sorties</th>
                    <th>Hours</th>
                    <th>As instructor</th>
                    <th>As trainee</th>
                  </tr>
                </thead>
                <tbody>
                  {f.personnel.pilots.map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td>{p.sorties}</td>
                      <td>{formatHours(p.hours)}</td>
                      <td>{formatHours(p.instructorHours)}</td>
                      <td>{formatHours(p.traineeHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {(f.period === 'MONTHLY' || f.period === 'QUARTERLY') && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
          <Card title="Maintenance performance">
            <p>
              Snags raised <strong>{f.maintenance.snagsRaised}</strong>, closed <strong>{f.maintenance.snagsClosed}</strong>. Average days to close: <strong>{f.maintenance.avgDaysToClose ?? '—'}</strong>.
            </p>
          </Card>
          <Card title="Safety performance">
            <p>
              Risk assessments: Low <strong>{f.safety.low}</strong>, Medium <strong>{f.safety.medium}</strong>, High <strong>{f.safety.high}</strong>; rejected <strong>{f.safety.rejected}</strong>. Hazard reports <strong>{f.safety.hazards}</strong>, incident reports{' '}
              <strong>{f.safety.incidents}</strong>. Sorties self-authorised by a crewed approver <strong>{f.safety.selfAuthorised ?? 0}</strong>.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
