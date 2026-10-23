import { requirePage } from '@/lib/auth/guard';
import { myOpenMissions } from '@/lib/plan-missions';
import { getSettings } from '@/lib/settings';
import { FlightPlanForm } from '@/components/flight-plan-form';
import { Card, PageHeader } from '@/components/ui';

export const metadata = { title: 'New Flight Plan' };

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage('flightplan.create');
  const sp = await searchParams;
  const [missions, settings] = await Promise.all([myOpenMissions(auth.user.id), getSettings()]);
  return (
    <>
      <PageHeader title="New Flight Plan" back={{ href: '/flight-plans', label: 'Flight Plans' }} sub="Draft it any time; submit it for the Operations Officer to approve. Works offline." />
      <Card>
        <FlightPlanForm
          missions={missions}
          initial={{
            missionId: missions.some((m) => m.id === sp.missionId) ? (sp.missionId as string) : '',
            departure: settings.homeAerodrome.icao ?? settings.homeAerodrome.name.slice(0, 4).toUpperCase(),
            destination: '',
            route: '',
            alternate: '',
            eetHours: '1',
            eetMinutes: '0',
            fuelRequired: '',
            fuelUnit: 'kg',
            crewNotes: '',
          }}
        />
      </Card>
    </>
  );
}
