import type { MissionListItem } from '@/lib/services/mission-queries';
import { missionTypeLabel, SEAT_SHORT, personName, type SeatValue } from '@/lib/constants';
import { localTime } from '@/lib/time';
import { Empty, MissionStatusPill, RiskPill } from './ui';
import { Avatar } from './avatar';

function gate(ok: boolean | null, label: string) {
  const cls = ok === null ? 'pill-none' : ok ? 'pill-good' : 'pill-warn';
  return (
    <span key={label} className={cls}>
      {label}
    </span>
  );
}

export function missionGates(m: MissionListItem) {
  const order = m.order ? (m.order.status === 'APPROVED' ? true : false) : false;
  const engr = m.status !== 'AWAITING_ENGINEERING' && m.aircraft.status === 'SERVICEABLE';
  const ready = m.crew.length > 0 && m.crew.every((c) => c.readiness === 'READY');
  const ra = m.riskAssessments[0];
  const risk = ra ? (ra.status === 'CLEARED' ? true : ra.status === 'SUBMITTED' ? false : null) : null;
  const plan = m.flightPlans[0] ? m.flightPlans[0].status === 'APPROVED' : null;
  return { order, engr, ready, risk, plan };
}

export function MissionTable({ missions, showGates = false, empty = 'No missions.' }: { missions: MissionListItem[]; showGates?: boolean; empty?: string }) {
  if (!missions.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table min-w-[760px]">
        <thead>
          <tr>
            <th>T/O</th>
            <th>Mission</th>
            <th>Aircraft</th>
            <th>Crew</th>
            <th>Ready</th>
            <th>Risk</th>
            {showGates && <th>Gates</th>}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {missions.map((m) => {
            const ready = m.crew.filter((c) => c.readiness === 'READY').length;
            const ra = m.riskAssessments[0];
            const g = missionGates(m);
            return (
              <tr key={m.id}>
                <td className="mono">{localTime(m.takeoffAt)}</td>
                <td>
                  <a href={`/missions/${m.id}`} className="mono no-underline">
                    {m.missionNo}
                  </a>
                  <div className="text-ink-muted">
                    {missionTypeLabel(m.type)} · {m.name}
                  </div>
                </td>
                <td className="mono">{m.aircraft.registration}</td>
                <td>
                  {m.crew.map((c) => (
                    <div key={c.id} className={`flex items-center gap-1.5 py-0.5 ${c.readiness === 'NOT_AVAILABLE' || c.readiness === 'NO_RESPONSE' ? 'font-semibold text-bad-fg' : ''}`}>
                      <Avatar user={c.user} size={22} />
                      <span>
                        {personName(c.user)} ({SEAT_SHORT[c.seat as SeatValue]})
                      </span>
                    </div>
                  ))}
                </td>
                <td>
                  <span className={ready === m.crew.length && m.crew.length ? 'pill-good' : m.crew.some((c) => c.readiness === 'NOT_AVAILABLE' || c.readiness === 'NO_RESPONSE') ? 'pill-bad' : 'pill-none'}>
                    {ready}/{m.crew.length}
                  </span>
                </td>
                <td>{ra && ra.status !== 'WITHDRAWN' ? <RiskPill level={ra.level} score={ra.totalScore} /> : <RiskPill level={null} />}</td>
                {showGates && (
                  <td>
                    <span className="inline-flex gap-1">
                      {gate(g.order, 'Order')}
                      {gate(g.engr, 'Engr')}
                      {gate(g.ready, 'Ready')}
                      {gate(g.risk, 'Risk')}
                      {gate(g.plan, 'Plan')}
                    </span>
                  </td>
                )}
                <td>
                  <MissionStatusPill status={m.status} takeoffAt={m.takeoffAt} landingAt={m.landingAt} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
