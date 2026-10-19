import { opsDashboard } from '@/lib/dashboards';
import { MissionTable } from '../mission-table';
import { Card, Empty, ReadinessPill } from '../ui';
import { PlainWeather, RawReport, ValidReport, WeatherTiles } from '../weather-panel';
import { Avatar } from '../avatar';
import { SEAT_LABEL, personName, type SeatValue } from '@/lib/constants';
import { formatLongDate, hm, localTime } from '@/lib/time';

export async function OpsDashboard({ canWeather }: { canWeather: boolean }) {
  const d = await opsDashboard();
  const live = d.todayMissions.filter((m) => !['COMPLETED', 'ABORTED', 'CANCELLED'].includes(m.status));
  const crew = live.flatMap((m) => m.crew.map((c) => ({ ...c, missionNo: m.missionNo, missionId: m.id, takeoffAt: m.takeoffAt })));
  const needAttention = crew.filter((c) => c.readiness === 'NOT_AVAILABLE' || c.readiness === 'NO_RESPONSE');
  const drafts = d.tomorrowMissions.filter((m) => m.status === 'DRAFT' || m.status === 'AWAITING_ENGINEERING').length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1>Operations</h1>
          <div className="text-ink-muted">{formatLongDate(d.today)}</div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a href="/mission-orders/new" className="btn-secondary">
            New mission order
          </a>
          <a href={`/schedule?date=${d.tomorrow}`} className="btn-primary">
            Tomorrow’s schedule{drafts ? ` (${drafts} unpublished)` : ''}
          </a>
        </div>
      </div>

      {needAttention.length > 0 && (
        <div className="alert-bad">
          <div className="font-semibold">Crew needs swapping</div>
          <ul className="ml-5 list-disc">
            {needAttention.map((c) => (
              <li key={c.id}>
                <a href={`/missions/${c.missionId}`}>{c.missionNo}</a> — {personName(c.user)} ({SEAT_LABEL[c.seat as SeatValue]}): {c.readiness === 'NO_RESPONSE' ? 'no reply' : `not available${c.readinessReason ? ` — ${c.readinessReason}` : ''}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[2_1_560px]" title="Today’s scheduled and active missions" actions={<span className="text-[13px] text-ink-muted">Gates: Order · Engr · Ready · Risk · Plan</span>} bodyClass="">
          <MissionTable missions={d.todayMissions} showGates empty="Nothing scheduled today." />
        </Card>
        <Card className="min-w-0 flex-[1_1_320px]" title={`Weather · ${d.metar?.station ?? '—'}`} actions={canWeather ? <a href="/weather" className="btn-outline btn-sm">Update METAR / TAF</a> : undefined}>
          <div className="flex flex-col gap-4">
            <ValidReport report={d.metar}>
              <div className="flex flex-col gap-4">
                <WeatherTiles metar={d.metar} />
                <PlainWeather report={d.metar} compact />
                <RawReport label="METAR" text={d.metar?.rawText} />
              </div>
            </ValidReport>
            <ValidReport report={d.taf}>
              <RawReport label="TAF" text={d.taf?.rawText} />
            </ValidReport>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[1_1_380px]" title="Crew availability today" bodyClass="">
          {crew.length === 0 ? (
            <Empty>No crew on today’s remaining missions.</Empty>
          ) : (
            crew.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 border-t border-[#EEF1F5] px-5 py-2.5 first:border-0">
                <div className="flex items-center gap-3">
                  <Avatar user={c.user} size={32} />
                  <div>
                    <div className="font-medium">{personName(c.user)}</div>
                    <div className="text-[12px] text-ink-muted">
                      {SEAT_LABEL[c.seat as SeatValue]} · {c.missionNo} · T/O {localTime(c.takeoffAt)}
                    </div>
                  </div>
                </div>
                <ReadinessPill value={c.readiness} />
              </div>
            ))
          )}
        </Card>
        <Card className="min-w-0 flex-[1_1_380px]" title="Flight plans to approve" actions={<a href="/flight-plans" className="text-[13px] font-semibold">All plans</a>} bodyClass="">
          {d.plans.length === 0 ? (
            <Empty>No plans waiting.</Empty>
          ) : (
            d.plans.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3 first:border-0">
                <div>
                  <div className="font-medium">
                    {p.mission?.missionNo ? `${p.mission.missionNo} · ` : ''}
                    {p.departure} → {p.destination}
                  </div>
                  <div className="text-[12px] text-ink-muted">
                    {personName(p.submittedBy)} · EET {hm(p.estFlightTimeMin)} · Alt {p.alternate}
                  </div>
                </div>
                <a href={`/flight-plans/${p.id}`} className="btn-primary btn-sm">
                  Review
                </a>
              </div>
            ))
          )}
        </Card>
      </div>
    </>
  );
}
