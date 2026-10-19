import { requirePage } from '@/lib/auth/guard';
import { AircraftForm } from '@/components/aircraft-form';
import { Card, PageHeader } from '@/components/ui';

export const metadata = { title: 'Add aircraft' };

export default async function NewAircraftPage() {
  await requirePage('aircraft.create');
  return (
    <>
      <PageHeader title="Add aircraft" back={{ href: '/aircraft', label: 'Aircraft' }} />
      <Card>
        <AircraftForm
          canRetire={false}
          initial={{
            registration: '',
            type: '',
            status: 'SERVICEABLE',
            flyingHours: '0:00',
            hoursToNextInspection: '100:00',
            inspectionIntervalHours: '100:00',
            inspectionIntervalDays: '',
            lastInspectionDate: '',
            nextInspectionDue: '',
            maintenanceRemarks: '',
          }}
        />
      </Card>
    </>
  );
}
