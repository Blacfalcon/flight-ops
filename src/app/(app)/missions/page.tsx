import { requirePage } from '@/lib/auth/guard';
import { listMissions } from '@/lib/services/mission-queries';
import { addDays, localDate } from '@/lib/time';
import { MissionTable } from '@/components/mission-table';
import { Card, PageHeader } from '@/components/ui';

export const metadata = { title: 'My Missions' };

export default async function MyMissionsPage() {
  const auth = await requirePage('dashboard.pilot');
  const today = localDate();
  const [upcoming, past] = await Promise.all([
    listMissions({ from: today, to: addDays(today, 30), userId: auth.user.id, includeDrafts: false }),
    listMissions({ from: addDays(today, -90), to: addDays(today, -1), userId: auth.user.id, includeDrafts: false }),
  ]);
  return (
    <>
      <PageHeader title="My Missions" sub="Your published missions for the next 30 days and the last 90." />
      <Card title="Upcoming" bodyClass="">
        <MissionTable missions={upcoming} empty="No upcoming missions." />
      </Card>
      <Card title="Flight History" bodyClass="">
        <MissionTable missions={past.reverse()} empty="No missions in the last 90 days." />
      </Card>
    </>
  );
}
