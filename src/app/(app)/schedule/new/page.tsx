import { requirePage } from '@/lib/auth/guard';
import { activePilots } from '@/lib/pilots';
import { addDays, localDate } from '@/lib/time';
import { localDateStr } from '@/lib/validators';
import { PageHeader } from '@/components/ui';
import { ScheduleBuilder } from '@/components/mission/schedule-builder';
import { approverHolders } from '@/lib/services/approvers';
import { getSettings } from '@/lib/settings';
import type { ApproverRoleKey } from '@/lib/rules/approvals';

export const metadata = { title: 'New sortie' };

export default async function NewMissionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage('mission.createTraining');
  const sp = await searchParams;
  const date = localDateStr.safeParse(sp.date).success ? (sp.date as string) : addDays(localDate(), 1);
  const [pilots, approvers, settings] = await Promise.all([activePilots(), approverHolders(), getSettings()]);
  return (
    <>
      <PageHeader title="New sortie and mission order" back={{ href: `/schedule?date=${date}`, label: 'Schedule' }} sub="The aircraft list comes from CO Engineering’s confirmation for the date." />
      <ScheduleBuilder
        canOperational={auth.perms.has('mission.createOperational')}
        pilots={pilots}
        approvers={approvers}
        requiredRiskRoles={settings.requiredApprovers as ApproverRoleKey[]}
        initial={{
          date,
          category: 'TRAINING',
          type: '',
          name: '',
          aircraftId: '',
          briefingTime: '06:30',
          takeoffTime: '07:30',
          landingTime: '09:00',
          crew: {},
          order: { taskDescription: '', objectives: '', priority: 'ROUTINE', operationalRemarks: '' },
        }}
      />
    </>
  );
}
