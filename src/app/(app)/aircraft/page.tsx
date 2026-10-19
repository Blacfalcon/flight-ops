import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { formatShortDate } from '@/lib/time';
import { AircraftStatusPill, Card, Empty, PageHeader } from '@/components/ui';
import { formatHours } from '@/lib/hours';

export const metadata = { title: 'Aircraft' };

export default async function AircraftPage() {
  const auth = await requirePage('aircraft.view');
  const aircraft = await db.aircraft.findMany({
    where: auth.perms.has('aircraft.create') ? {} : { active: true },
    include: { _count: { select: { snags: { where: { status: 'OPEN' } } } } },
    orderBy: { registration: 'asc' },
  });
  return (
    <>
      <PageHeader
        title="Aircraft"
        sub="Fleet register. CO Engineering keeps status and hours up to date."
        actions={auth.perms.has('aircraft.create') ? <a href="/aircraft/new" className="btn-primary">Add aircraft</a> : undefined}
      />
      <Card bodyClass="">
        {aircraft.length === 0 ? (
          <Empty>No aircraft yet. Admin adds aircraft to the register.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[820px]">
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Flying hours</th>
                  <th>To inspection</th>
                  <th>Interval</th>
                  <th>Next inspection</th>
                  <th>Open snags</th>
                </tr>
              </thead>
              <tbody>
                {aircraft.map((a) => (
                  <tr key={a.id} className={a.active ? '' : 'opacity-60'}>
                    <td>
                      <a href={`/aircraft/${a.id}`} className="mono no-underline">
                        {a.registration}
                      </a>
                      {!a.active && <span className="pill-none ml-2">Retired</span>}
                    </td>
                    <td>{a.type}</td>
                    <td>
                      <AircraftStatusPill status={a.status} />
                    </td>
                    <td className="mono">{formatHours(a.flyingHours)}</td>
                    <td className="mono">{formatHours(a.hoursToNextInspection)} h</td>
                    <td>
                      {formatHours(a.inspectionIntervalHours)} h{a.inspectionIntervalDays ? ` / ${a.inspectionIntervalDays} days` : ''}
                    </td>
                    <td>{a.nextInspectionDue ? formatShortDate(a.nextInspectionDue) : '—'}</td>
                    <td>{a._count.snags || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
