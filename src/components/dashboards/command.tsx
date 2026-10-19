import { commandDashboard } from '@/lib/dashboards';
import { MissionTable } from '../mission-table';
import { ApprovalSummary } from '../approval-card';
import { AircraftStatusPill, Card, Empty, Kpi } from '../ui';
import { formatLongDate, localTime } from '@/lib/time';
import { PRIORITY_LABEL, missionTypeLabel, personName } from '@/lib/constants';
import { formatShortDate } from '@/lib/time';
import { formatHours } from '@/lib/hours';

export async function CommandDashboard({ title }: { title: string }) {
  const d = await commandDashboard();
  const flown = d.missions.filter((m) => m.status === 'COMPLETED').length;
  const aborted = d.missions.filter((m) => m.status === 'ABORTED').length;
  const airborne = d.missions.filter((m) => m.status === 'CLEARED' && m.takeoffAt <= new Date() && m.landingAt > new Date()).length;
  const toGo = d.missions.filter((m) => !['COMPLETED', 'ABORTED', 'CANCELLED'].includes(m.status)).length - airborne;
  const serviceable = d.aircraft.filter((a) => a.status === 'SERVICEABLE').length;
  const unserviceable = d.aircraft.filter((a) => a.status === 'UNSERVICEABLE' || a.status === 'UNDER_MAINTENANCE').length;
  const due = d.aircraft.filter((a) => a.status === 'INSPECTION_DUE').length;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1>{title}</h1>
        <div className="text-ink-muted">{formatLongDate(d.today)}</div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
        <Kpi label="Today's flights" value={d.missions.length} sub={`${airborne} airborne · ${flown} completed · ${aborted} aborted · ${Math.max(toGo, 0)} to go`} />
        <Kpi label="Aircraft available" value={<>{serviceable}<span className="text-lg font-medium text-ink-muted"> / {d.aircraft.length}</span></>} sub={`${unserviceable} unserviceable · ${due} inspection due`} />
        <Kpi
          label="Crew readiness"
          value={<>{d.readiness.ready}<span className="text-lg font-medium text-ink-muted"> / {d.readiness.total} ready</span></>}
          sub={d.readiness.notAvailable ? <span className="font-medium text-bad-fg">{d.readiness.notAvailable} not available or no reply</span> : `${d.readiness.awaiting} awaiting reply`}
        />
        <Kpi label="Mission orders to approve" value={d.orders.length} sub="CO Flying Wing or the Commander" tone={d.orders.length ? 'warn' : undefined} />
        <Kpi label="Risk approvals pending" value={d.pending.length} sub={`Today: ${d.risk.low} Low · ${d.risk.medium} Medium · ${d.risk.high} High`} tone={d.pending.length ? 'warn' : undefined} />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-6">
          <Card title="Today's flights" actions={<a href="/schedule" className="text-[13px] font-semibold">Open schedule</a>} bodyClass="">
            <MissionTable missions={d.missions} empty="No flights scheduled today." />
          </Card>
          <Card
            title="Aircraft availability"
            actions={<span className="text-[13px] text-ink-muted">{d.confirmedAt ? `Confirmed by ${d.confirmedBy ? personName(d.confirmedBy) : 'CO Engr'} ${localTime(d.confirmedAt)}` : 'Not yet confirmed today'}</span>}
          >
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              {d.aircraft.map((a) => (
                <a key={a.id} href={`/aircraft/${a.id}`} className="flex flex-col gap-2 rounded-lg border border-[#E1E7EF] px-3.5 py-3 text-ink no-underline hover:border-brand">
                  <span className="mono">{a.registration}</span>
                  <AircraftStatusPill status={a.status} />
                  <span className="text-[12px] text-ink-muted">{formatHours(a.hoursToNextInspection)} to inspection</span>
                </a>
              ))}
            </div>
          </Card>
        </div>
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-6">
        <Card title="Mission orders awaiting approval" actions={<a href="/mission-orders?tab=SUBMITTED" className="text-[13px] font-semibold">All orders</a>} bodyClass="">
          {d.orders.length === 0 ? (
            <Empty>No mission orders waiting.</Empty>
          ) : (
            d.orders.slice(0, 6).map((o) => (
              <a key={o.id} href={`/mission-orders/${o.id}`} className="flex items-start justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3 text-ink no-underline first:border-0 hover:bg-ground">
                <span>
                  <span className="mono">{o.orderNo}</span> · <span className="mono">{o.mission.missionNo}</span>
                  <span className="block text-[13px] text-ink-muted">
                    {missionTypeLabel(o.mission.type)} · {formatShortDate(o.mission.takeoffAt)} {localTime(o.mission.takeoffAt)} · by {personName(o.createdBy)}
                  </span>
                </span>
                <span className={o.priority === 'IMMEDIATE' ? 'pill-bad' : o.priority === 'PRIORITY' ? 'pill-warn' : 'pill-none'}>{PRIORITY_LABEL[o.priority]}</span>
              </a>
            ))
          )}
        </Card>
        <Card id="approvals" title="Awaiting decision" actions={<a href="/risk" className="text-[13px] font-semibold">All approvals</a>}>
          {d.pending.length === 0 ? (
            <Empty>Nothing is waiting for approval.</Empty>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {d.pending.slice(0, 3).map((ra) => (
                <div key={ra.id} className="py-4 first:pt-0">
                  <ApprovalSummary ra={ra} />
                  <a href={`/risk/${ra.id}`} className="btn-primary mt-4 w-full">
                    Review and decide
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
        </div>
      </div>
    </>
  );
}
