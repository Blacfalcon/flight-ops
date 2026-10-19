import { pilotDashboard } from '@/lib/dashboards';
import { Card, Empty, MissionStatusPill, ReadinessPill } from '../ui';
import { missionTypeLabel, SEAT_LABEL, type SeatValue } from '@/lib/constants';
import { countdown, formatShortDate, hm, localDate, localTime } from '@/lib/time';
import { ReadinessButtons } from '../mission/readiness-buttons';
import { PlainWeather, ValidReport } from '../weather-panel';

export async function PilotDashboard({ userId, name, compact = false }: { userId: string; name: string; compact?: boolean }) {
  const d = await pilotDashboard(userId);
  const open = d.upcoming.filter((m) => !['COMPLETED', 'ABORTED'].includes(m.status));
  const next = open[0];
  const mySeat = next?.crew.find((c) => c.userId === userId);
  const asked = next && mySeat && next.readinessRequestedAt && mySeat.readiness === 'PENDING' && ['PUBLISHED', 'CREW_READY'].includes(next.status);

  return (
    <>
      {!compact && (
        <div className="flex flex-col gap-1">
          <h1>{name}</h1>
          <div className="text-ink-muted">This month: {hm(d.monthMinutes)} h flown</div>
        </div>
      )}

      {next ? (
        <section className={`card flex flex-col gap-4 p-5 ${asked ? 'border-2 border-brand' : ''}`} aria-label="Next mission">
          <div className="flex items-center justify-between gap-3">
            {asked ? <span className="pill-info">READINESS REQUESTED</span> : <MissionStatusPill status={next.status} takeoffAt={next.takeoffAt} landingAt={next.landingAt} />}
            <span className="font-mono font-medium text-warn-fg">{localDate(next.takeoffAt) === d.today ? countdown(next.takeoffAt) : formatShortDate(next.takeoffAt)}</span>
          </div>
          <div>
            <a href={`/missions/${next.id}`} className="mono text-[22px] no-underline">
              {next.missionNo}
            </a>
            <div className="text-ink-muted">
              {missionTypeLabel(next.type)} · {next.aircraft.registration} · Take-off {localTime(next.takeoffAt)}
              {mySeat ? ` · You: ${SEAT_LABEL[mySeat.seat as SeatValue]}` : ''}
            </div>
          </div>
          {asked && <ReadinessButtons missionId={next.id} missionNo={next.missionNo} />}
          <a href={`/missions/${next.id}`} className="btn-secondary">
            Open mission
          </a>
        </section>
      ) : (
        <Card title="Next mission">
          <Empty>No missions for you in the next 7 days.</Empty>
        </Card>
      )}

      {d.metar && (
        <section aria-label="Weather" className="flex flex-col gap-2">
          <ValidReport report={d.metar}>
            <PlainWeather report={d.metar} compact />
          </ValidReport>
          <a href="/weather" className="self-start text-[13px] font-semibold">
            Full weather and TAF
          </a>
        </section>
      )}

      <Card title="My upcoming missions" actions={<a href="/missions" className="text-[13px] font-semibold">All</a>} bodyClass="">
        {open.length <= 1 ? (
          <Empty>Nothing else scheduled.</Empty>
        ) : (
          open.slice(1).map((m) => {
            const seat = m.crew.find((c) => c.userId === userId);
            return (
              <a key={m.id} href={`/missions/${m.id}`} className="flex items-center justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3 text-ink no-underline first:border-0 hover:bg-ground">
                <div>
                  <div className="mono">{m.missionNo}</div>
                  <div className="text-[12px] text-ink-muted">
                    {formatShortDate(m.takeoffAt)} {localTime(m.takeoffAt)} · {m.aircraft.registration}
                  </div>
                </div>
                {seat && <ReadinessPill value={seat.readiness} />}
              </a>
            );
          })
        )}
      </Card>

      {!compact && (
        <Card title="Recent flights" bodyClass="">
          {d.recent.length === 0 ? (
            <Empty>No flights recorded yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Mission</th>
                    <th>Outcome</th>
                    <th>Flight time</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((r) => (
                    <tr key={r.id}>
                      <td>{formatShortDate(r.mission.takeoffAt)}</td>
                      <td className="mono">{r.mission.missionNo}</td>
                      <td>{r.outcome === 'COMPLETED' ? <span className="pill-good">Completed</span> : <span className="pill-bad">Aborted</span>}</td>
                      <td className="mono">{hm(r.flightTimeMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
