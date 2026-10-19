import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { dateOnlyToString, formatDateTime, formatShortDate, localDate } from '@/lib/time';
import { Card, Empty, PageHeader } from '@/components/ui';
import { GenerateReport } from '@/components/generate-report';

export const metadata = { title: 'Reports' };

const LABEL: Record<string, string> = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage('summary.view');
  const sp = await searchParams;
  const period = sp.period && LABEL[sp.period] ? sp.period : undefined;
  const reports = await db.summaryReport.findMany({
    where: period ? { period: period as never } : {},
    orderBy: [{ periodStart: 'desc' }, { period: 'asc' }],
    take: 120,
  });
  return (
    <>
      <PageHeader title="Reports" sub="Summaries are generated automatically: daily after flying, weekly on Sunday, monthly and quarterly on the first day. The Operations Officer, CO Flying Wing and the Commander generate and export reports; the Safety Officer exports the safety extract." />
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {[undefined, 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY'].map((p) => (
          <a key={p ?? 'all'} href={`/reports${p ? `?period=${p}` : ''}`} aria-current={period === p ? 'page' : undefined} className={`rounded-full px-4 py-2 text-[13px] font-semibold no-underline ${period === p ? 'bg-navy text-white' : 'bg-white text-ink'}`}>
            {p ? LABEL[p] : 'All'}
          </a>
        ))}
      </nav>
      {auth.perms.has('summary.export') && (
        <Card title="Generate now">
          <GenerateReport today={localDate()} />
        </Card>
      )}
      <Card bodyClass="">
        {reports.length === 0 ? (
          <Empty>No summaries yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[600px]">
              <thead>
                <tr>
                  <th>Summary</th>
                  <th>Period</th>
                  <th>Generated</th>
                  <th>Export</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const start = dateOnlyToString(r.periodStart);
                  const end = dateOnlyToString(r.periodEnd);
                  return (
                    <tr key={r.id}>
                      <td>
                        <a href={`/reports/${r.id}`} className="font-semibold no-underline">
                          {LABEL[r.period]} summary
                        </a>
                      </td>
                      <td>{start === end ? formatShortDate(start) : `${formatShortDate(start)} – ${formatShortDate(end)}`}</td>
                      <td>{formatDateTime(r.generatedAt)}</td>
                      <td className="whitespace-nowrap">
                        {auth.perms.has('summary.export') ? (
                          <>
                            <a href={`/api/v1/reports/${r.id}/export?format=pdf`}>PDF</a> · <a href={`/api/v1/reports/${r.id}/export?format=xlsx`}>Excel</a>
                          </>
                        ) : auth.perms.has('summary.exportSafety') ? (
                          <a href={`/api/v1/reports/${r.id}/export?format=pdf&part=safety`}>Safety PDF</a>
                        ) : (
                          <span className="text-ink-muted">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
