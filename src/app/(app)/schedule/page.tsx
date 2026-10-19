import { requirePage } from '@/lib/auth/guard';
import { listMissions } from '@/lib/services/mission-queries';
import { addDays, formatLongDate, localDate } from '@/lib/time';
import { localDateStr } from '@/lib/validators';
import { db } from '@/lib/db';
import { dateOnly } from '@/lib/time';
import { MissionTable } from '@/components/mission-table';
import { Card, PageHeader } from '@/components/ui';
import { PublishBar } from './publish-bar';

export const metadata = { title: 'Schedule' };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage('schedule.viewAll');
  const sp = await searchParams;
  const date = localDateStr.safeParse(sp.date).success ? (sp.date as string) : localDate();
  const canBuild = auth.perms.has('mission.createTraining');
  const [missions, aircraftCount, checks] = await Promise.all([
    listMissions({ date, includeDrafts: canBuild }),
    db.aircraft.count({ where: { active: true } }),
    db.serviceabilityCheck.count({ where: { flyingDate: dateOnly(date) } }),
  ]);
  const unpublished = missions.filter((m) => m.status === 'DRAFT' || m.status === 'AWAITING_ENGINEERING');

  return (
    <>
      <PageHeader
        title="Schedule"
        sub={formatLongDate(date)}
        actions={
          <>
            <a href={`/schedule?date=${addDays(date, -1)}`} className="btn-secondary btn-sm" aria-label="Previous day">
              ←
            </a>
            <form action="/schedule" className="flex">
              <label htmlFor="date" className="sr-only">
                Date
              </label>
              <input id="date" name="date" type="date" defaultValue={date} className="input h-9 w-auto" />
              <button className="btn-secondary btn-sm ml-1">Go</button>
            </form>
            <a href={`/schedule?date=${addDays(date, 1)}`} className="btn-secondary btn-sm" aria-label="Next day">
              →
            </a>
            {canBuild && (
              <a href={`/schedule/new?date=${date}`} className="btn-primary">
                New mission
              </a>
            )}
          </>
        }
      />

      {checks < aircraftCount && (
        <div className="alert-warn">
          CO Engineering has confirmed {checks} of {aircraftCount} aircraft for this date. Missions on unconfirmed aircraft wait as “Awaiting engineering” and cannot be published.
        </div>
      )}

      {auth.perms.has('mission.publish') && unpublished.length > 0 && (
        <PublishBar missions={unpublished.map((m) => ({ id: m.id, missionNo: m.missionNo, status: m.status, orderStatus: m.order?.status ?? null }))} />
      )}
      {canBuild && !auth.perms.has('mission.publish') && unpublished.length > 0 && (
        <div className="alert-warn">
          {unpublished.length} sortie{unpublished.length === 1 ? '' : 's'} not yet published. Mission orders go to CO Flying Wing or the Commander for approval; the Operations Officer then publishes.
        </div>
      )}

      <Card title={`${missions.length} mission${missions.length === 1 ? '' : 's'}`} bodyClass="">
        <MissionTable missions={missions} showGates empty="Nothing scheduled for this date." />
      </Card>
    </>
  );
}
