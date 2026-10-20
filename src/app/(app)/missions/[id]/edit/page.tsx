import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { activePilots } from '@/lib/pilots';
import { localDate, localTime } from '@/lib/time';
import { PageHeader } from '@/components/ui';
import { ScheduleBuilder } from '@/components/mission/schedule-builder';
import { approverHolders } from '@/lib/services/approvers';
import { getSettings } from '@/lib/settings';
import type { ApproverRoleKey } from '@/lib/rules/approvals';
import type { SeatValue } from '@/lib/constants';

export const metadata = { title: 'Edit mission' };

export default async function EditMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePage('mission.createTraining');
  const { id } = await params;
  const m = await db.mission.findUnique({ where: { id }, include: { crew: true, order: true } });
  if (!m) notFound();
  if (m.category !== 'TRAINING' && !auth.perms.has('mission.createOperational')) notFound();
  const [pilots, approvers, settings] = await Promise.all([activePilots(), approverHolders(), getSettings()]);
  const crew: Partial<Record<SeatValue, string>> = {};
  for (const c of m.crew) crew[c.seat as SeatValue] = c.userId;
  return (
    <>
      <PageHeader title={`Edit ${m.missionNo}`} back={{ href: `/missions/${m.id}`, label: m.missionNo }} sub="Changing aircraft, times or crew after publication sends the mission back through its gates and tells the crew. A changed order goes back to CO Flying Wing and the Commander." />
      <ScheduleBuilder
        canOperational={auth.perms.has('mission.createOperational')}
        pilots={pilots}
        approvers={approvers}
        requiredRiskRoles={settings.requiredApprovers as ApproverRoleKey[]}
        initial={{
          id: m.id,
          date: localDate(m.takeoffAt),
          category: m.category,
          type: m.type,
          name: m.name,
          aircraftId: m.aircraftId,
          briefingTime: localTime(m.briefingAt),
          takeoffTime: localTime(m.takeoffAt),
          landingTime: localTime(m.landingAt),
          crew,
          order: {
            taskDescription: m.order?.taskDescription ?? '',
            objectives: m.order?.objectives ?? '',
            priority: m.order?.priority ?? 'ROUTINE',
            operationalRemarks: m.order?.operationalRemarks ?? '',
          },
          orderNo: m.order?.orderNo,
          orderStatus: m.order?.status,
        }}
      />
    </>
  );
}
