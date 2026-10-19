import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { loadRisk } from '@/lib/services/risk-queries';
import { approverRolesFor } from '@/lib/rbac';
import { APPROVER_ROLE_LABEL, IMSAFE_ITEMS, personName } from '@/lib/constants';
import { formatDateTime } from '@/lib/time';
import { ApprovalSummary } from '@/components/approval-card';
import { Card, PageHeader } from '@/components/ui';
import { RiskActions } from '@/components/risk/risk-actions';

export const metadata = { title: 'Risk assessment' };

export default async function RiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePage();
  const { id } = await params;
  const ra = await loadRisk(id);
  if (!ra) notFound();
  const onCrew = ra.mission.crew.some((c) => c.userId === auth.user.id);
  if (!auth.perms.has('risk.view') && !onCrew) notFound();

  const myRoles = approverRolesFor(auth.roles).filter((r) => ra.approvals.some((a) => a.approverRole === r && !a.decision));
  const imsafeComplete = ra.mission.crew.every((c) => ra.imsafe.some((i) => i.userId === c.userId));
  const canDecide = ra.status === 'SUBMITTED' && myRoles.length > 0 && !onCrew;

  return (
    <>
      <PageHeader
        back={{ href: '/risk', label: 'Risk approvals' }}
        title={`${ra.mission.missionNo} · risk assessment v${ra.version}`}
        sub={`Submitted by ${personName(ra.submittedBy)} · ${formatDateTime(ra.createdAt)}`}
        actions={<a href={`/missions/${ra.mission.id}`} className="btn-secondary btn-sm">Open mission</a>}
      />
      {ra.status !== 'SUBMITTED' && (
        <div className={ra.status === 'CLEARED' ? 'alert-good' : ra.status === 'REJECTED' ? 'alert-bad' : 'alert-warn'}>
          {ra.status === 'CLEARED' ? 'Cleared to fly.' : ra.status === 'REJECTED' ? 'Rejected. The crew has been asked to revise.' : 'Withdrawn (the mission changed or was closed).'}
        </div>
      )}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-6">
          <Card title="Assessment">
            <ApprovalSummary ra={ra} />
            {ra.weatherLoweredReason && (
              <p className="mt-3 text-[13px]">
                <span className="font-semibold">Weather rated below the METAR suggestion:</span> {ra.weatherLoweredReason}
              </p>
            )}
          </Card>
          <Card title="IMSAFE" bodyClass="">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Crew</th>
                    {IMSAFE_ITEMS.map((i) => (
                      <th key={i.key}>{i.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ra.mission.crew.map((c) => {
                    const row = ra.imsafe.find((i) => i.userId === c.userId);
                    return (
                      <tr key={c.id}>
                        <td className="font-medium">{personName(c.user)}</td>
                        {IMSAFE_ITEMS.map((i) => (
                          <td key={i.key}>{!row ? <span className="pill-none">Waiting</span> : row[i.key] ? <span className="pill-bad">Yes</span> : <span className="pill-good">No</span>}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Decisions" bodyClass="">
            {ra.approvals.map((a) => (
              <div key={a.id} className="border-t border-[#EEF1F5] px-5 py-3 first:border-0">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">{APPROVER_ROLE_LABEL[a.approverRole]}</span>
                  <span className="text-[13px] text-ink-muted">{a.approver ? `${personName(a.approver)}${a.actingFor ? ' (acting Commander)' : ''}` : 'Waiting'}</span>
                </div>
                {a.remarks && <p className="mt-1 text-[14px]">{a.remarks}</p>}
              </div>
            ))}
          </Card>
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <Card title={canDecide ? 'Comments and your decision' : 'Comments'}>
            <RiskActions
              riskId={ra.id}
              canComment={auth.perms.has('risk.comment')}
              decide={canDecide ? { roles: myRoles, high: ra.level === 'HIGH', ready: imsafeComplete } : null}
              comments={ra.comments.map((c) => ({ id: c.id, author: personName(c.author), body: c.body, at: formatDateTime(c.createdAt) }))}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
