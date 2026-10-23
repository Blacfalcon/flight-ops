import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { addDays, dateOnly, formatLongDate, localDate } from '@/lib/time';
import { localDateStr } from '@/lib/validators';
import { PageHeader } from '@/components/ui';
import { ServiceabilityForm } from '@/components/serviceability-form';

export const metadata = { title: 'Daily Confirmation' };

export default async function ServiceabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage('serviceability.confirm');
  const sp = await searchParams;
  const date = localDateStr.safeParse(sp.date).success ? (sp.date as string) : addDays(localDate(), 1);
  const [aircraft, checks] = await Promise.all([
    db.aircraft.findMany({ where: { active: true }, orderBy: { registration: 'asc' } }),
    db.serviceabilityCheck.findMany({ where: { flyingDate: dateOnly(date) } }),
  ]);
  const rows = aircraft.map((a) => {
    const c = checks.find((x) => x.aircraftId === a.id);
    return {
      id: a.id,
      registration: a.registration,
      type: a.type,
      currentStatus: a.status,
      status: c?.status ?? a.status,
      confirmed: !!c,
      hoursToNextInspection: Number(a.hoursToNextInspection),
      remarks: c?.remarks ?? a.maintenanceRemarks ?? '',
    };
  });
  return (
    <>
      <PageHeader
        title="Confirm Serviceability"
        sub={formatLongDate(date)}
        actions={
          <>
            <a href={`/engineering/serviceability?date=${addDays(date, -1)}`} className="btn-secondary btn-sm">
              ← Previous day
            </a>
            <a href={`/engineering/serviceability?date=${addDays(date, 1)}`} className="btn-secondary btn-sm">
              Next day →
            </a>
          </>
        }
      />
      <div className="alert-info">Ops cannot publish missions for this date on any aircraft you have not confirmed Serviceable. Marking an aircraft anything else sends its missions back for re-assignment.</div>
      <ServiceabilityForm date={date} rows={rows} />
    </>
  );
}
