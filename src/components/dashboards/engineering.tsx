import { engineeringDashboard } from '@/lib/dashboards';
import { AircraftStatusPill, Card, Empty, Kpi } from '../ui';
import { formatLongDate, formatShortDate } from '@/lib/time';
import { personName } from '@/lib/constants';
import { formatHours } from '@/lib/hours';

export async function EngineeringDashboard({ canConfirm = true }: { canConfirm?: boolean }) {
  const d = await engineeringDashboard();
  const serviceable = d.aircraft.filter((a) => a.status === 'SERVICEABLE').length;
  const down = d.aircraft.filter((a) => a.status === 'UNSERVICEABLE' || a.status === 'UNDER_MAINTENANCE').length;
  const tomorrowDone = d.aircraft.length > 0 && d.aircraft.every((a) => d.checksTomorrow.some((c) => c.aircraftId === a.id));
  const todayDone = d.aircraft.length > 0 && d.aircraft.every((a) => d.checksToday.some((c) => c.aircraftId === a.id));

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1>{canConfirm ? 'Engineering' : 'Engineering (Engineering Officer)'}</h1>
        <div className="text-ink-muted">{formatLongDate(d.today)}</div>
      </div>

      {(!todayDone || !tomorrowDone) && (
        <div className="alert-info flex flex-wrap items-center justify-between gap-3">
          <span>
            {!todayDone ? 'Today’s serviceability is not fully confirmed.' : 'Tomorrow’s serviceability is not confirmed yet.'} Ops cannot publish missions on unconfirmed aircraft.
            {!canConfirm && ' CO Engineering makes the daily confirmation; keep aircraft status, hours and snags up to date so it is ready.'}
          </span>
          {canConfirm && (
            <a href={`/engineering/serviceability?date=${todayDone ? d.tomorrow : d.today}`} className="btn-primary btn-sm">
              Confirm now
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
        <Kpi label="Serviceable" value={<span className="text-good-fg">{serviceable}</span>} />
        <Kpi label="Unserviceable / maintenance" value={<span className="text-bad-fg">{down}</span>} />
        <Kpi label={`Inspection due ≤ ${d.warning.days} days or ${d.warning.hours} h`} value={<span className="text-warn-fg">{d.dueSoon.length}</span>} />
        <Kpi label="Open snags" value={d.snags.length} />
      </div>

      <Card title="Fleet Status" actions={<a href="/aircraft" className="text-[13px] font-semibold">Fleet records</a>} bodyClass="">
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Aircraft</th>
                <th>Status</th>
                <th>Flying hours</th>
                <th>Hours to inspection</th>
                <th>Next inspection</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {d.aircraft.map((a) => {
                const left = Number(a.hoursToNextInspection);
                const pct = Math.max(2, Math.min(100, (left / Number(a.inspectionIntervalHours)) * 100));
                const colour = left <= 0 ? 'bg-bad-solid' : left <= d.warning.hours ? 'bg-warn-solid' : 'bg-brand';
                return (
                  <tr key={a.id}>
                    <td>
                      <a href={`/aircraft/${a.id}`} className="mono no-underline">
                        {a.registration}
                      </a>
                      <div className="text-ink-muted">{a.type}</div>
                    </td>
                    <td>
                      <AircraftStatusPill status={a.status} />
                    </td>
                    <td className="mono">{formatHours(a.flyingHours)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded bg-[#E8EDF3]">
                          <div className={`h-2 ${colour}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="mono">{formatHours(left)}</span>
                      </div>
                    </td>
                    <td>{a.nextInspectionDue ? formatShortDate(a.nextInspectionDue) : '—'}</td>
                    <td className="text-ink-muted">{a.maintenanceRemarks ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[1_1_420px]" title="Open Snags" actions={<a href="/engineering/snags" className="text-[13px] font-semibold">All snags</a>} bodyClass="">
          {d.snags.length === 0 ? (
            <Empty>No open snags.</Empty>
          ) : (
            d.snags.slice(0, 8).map((s) => (
              <div key={s.id} className="border-t border-[#EEF1F5] px-5 py-3 first:border-0">
                <div className="font-medium">
                  {s.aircraft.registration} · {s.description}
                </div>
                <div className="text-[12px] text-ink-muted">
                  Raised by {personName(s.raisedBy)} · {formatShortDate(s.createdAt)}
                </div>
              </div>
            ))
          )}
        </Card>
        <Card className="min-w-0 flex-[1_1_320px]" title="Maintenance Alerts">
          {d.dueSoon.length === 0 ? (
            <Empty>No inspections due soon.</Empty>
          ) : (
            <div className="flex flex-col gap-2.5">
              {d.dueSoon.map((a) => (
                <div key={a.id} className={Number(a.hoursToNextInspection) <= 0 ? 'alert-bad' : 'alert-warn'}>
                  <span className="font-bold">{a.registration}</span> — {formatHours(a.hoursToNextInspection)} left
                  {a.nextInspectionDue ? `, due ${formatShortDate(a.nextInspectionDue)}` : ''}.
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
