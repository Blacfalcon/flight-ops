import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { personName } from '@/lib/constants';
import { formatDateTime } from '@/lib/time';
import { Card, Empty, PageHeader } from '@/components/ui';
import { SafetyReportForm, SafetyStatus } from '@/components/safety-actions';

export const metadata = { title: 'Safety' };

export default async function SafetyPage() {
  const auth = await requirePage(['safety.view', 'safety.raise']);
  const all = auth.perms.has('safety.view');
  const [reports, aircraft] = await Promise.all([
    db.safetyReport.findMany({
      where: all ? {} : { reportedById: auth.user.id },
      include: { reportedBy: { select: nameOnly }, aircraft: { select: { registration: true } }, mission: { select: { id: true, missionNo: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.aircraft.findMany({ where: { active: true }, select: { id: true, registration: true }, orderBy: { registration: 'asc' } }),
  ]);
  return (
    <>
      <PageHeader title="Safety" sub="Report hazards and incidents. The Safety Officer reviews every report." />
      {auth.perms.has('safety.raise') && (
        <Card title="Report a Hazard or Incident">
          <SafetyReportForm aircraft={aircraft} />
        </Card>
      )}
      <Card title={all ? 'All reports' : 'My reports'} bodyClass="">
        {reports.length === 0 ? (
          <Empty>No reports.</Empty>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3.5 first:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={r.kind === 'INCIDENT' ? 'pill-bad' : 'pill-warn'}>{r.kind === 'INCIDENT' ? 'Incident' : 'Hazard'}</span>
                  <span className="text-[12px] text-ink-muted">
                    {personName(r.reportedBy)} · {formatDateTime(r.createdAt)}
                    {r.location ? ` · ${r.location}` : ''}
                    {r.aircraft ? ` · ${r.aircraft.registration}` : ''}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line">{r.description}</p>
              </div>
              {auth.perms.has('safety.manage') ? (
                <SafetyStatus reportId={r.id} status={r.status} />
              ) : (
                <span className={r.status === 'CLOSED' ? 'pill-good' : 'pill-none'}>{r.status === 'UNDER_REVIEW' ? 'Under review' : r.status.charAt(0) + r.status.slice(1).toLowerCase()}</span>
              )}
            </div>
          ))
        )}
      </Card>
    </>
  );
}
