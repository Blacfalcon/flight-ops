import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { APPOINTMENT_LABEL, FLIGHT_STATUS_LABEL, PILOT_CATEGORY_LABEL, RANK_LABEL, personName } from '@/lib/constants';
import { formatDateTime } from '@/lib/time';
import { Card, Empty, PageHeader } from '@/components/ui';
import { DecideRequest } from '@/components/decide-request';

export const metadata = { title: 'Change requests' };

const LABELS: Record<string, { title: string; values: Record<string, string> }> = {
  rank: { title: 'Rank', values: RANK_LABEL },
  appointment: { title: 'Appointment', values: APPOINTMENT_LABEL },
  flightStatus: { title: 'Flight status', values: FLIGHT_STATUS_LABEL },
  pilotCategory: { title: 'Pilot category', values: PILOT_CATEGORY_LABEL },
};

export default async function RequestsPage() {
  await requirePage('changeRequest.decide');
  const [pending, recent] = await Promise.all([
    db.profileChangeRequest.findMany({ where: { status: 'PENDING' }, include: { user: { select: nameOnly } }, orderBy: { createdAt: 'asc' } }),
    db.profileChangeRequest.findMany({ where: { status: { not: 'PENDING' } }, include: { user: { select: nameOnly }, decidedBy: { select: nameOnly } }, orderBy: { decidedAt: 'desc' }, take: 30 }),
  ]);
  const describe = (r: { field: string; oldValue: string; newValue: string }) => {
    const l = LABELS[r.field];
    return `${l?.title ?? r.field}: ${l?.values[r.oldValue] ?? r.oldValue} → ${l?.values[r.newValue] ?? r.newValue}`;
  };
  return (
    <>
      <PageHeader title="Change requests" sub="Changes to rank, appointment, flight status or pilot category take effect only after approval. An appointment change signs the person out." />
      <Card title={`Pending (${pending.length})`} bodyClass="">
        {pending.length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          pending.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3.5 first:border-0">
              <div>
                <div className="font-semibold">{personName(r.user)}</div>
                <div>{describe(r)}</div>
                <div className="text-[12px] text-ink-muted">
                  {formatDateTime(r.createdAt)}
                  {r.reason ? ` · “${r.reason}”` : ''}
                </div>
              </div>
              <DecideRequest id={r.id} />
            </div>
          ))
        )}
      </Card>
      <Card title="Recently decided" bodyClass="">
        {recent.length === 0 ? (
          <Empty>None.</Empty>
        ) : (
          recent.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3 first:border-0">
              <div>
                <span className="font-semibold">{personName(r.user)}</span> · {describe(r)}
                <div className="text-[12px] text-ink-muted">
                  {r.decidedBy ? personName(r.decidedBy) : ''} {r.decidedAt ? formatDateTime(r.decidedAt) : ''}
                </div>
              </div>
              <span className={r.status === 'APPROVED' ? 'pill-good' : 'pill-bad'}>{r.status === 'APPROVED' ? 'Approved' : 'Rejected'}</span>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
