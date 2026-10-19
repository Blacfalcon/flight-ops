import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { personName } from '@/lib/constants';
import { formatShortDate, hm } from '@/lib/time';
import { fuelLabel } from '@/lib/fuel';
import { Card, Empty, PageHeader } from '@/components/ui';

export const metadata = { title: 'Flight plans' };

const TONE: Record<string, string> = { DRAFT: 'pill-none', SUBMITTED: 'pill-warn', APPROVED: 'pill-good' };

export default async function FlightPlansPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const auth = await requirePage(['flightplan.viewAll', 'flightplan.create']);
  const sp = await searchParams;
  const all = auth.perms.has('flightplan.viewAll') && sp.mine !== '1';
  const status = ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(sp.status ?? '') ? sp.status : undefined;
  const plans = await db.flightPlan.findMany({
    where: { ...(all ? {} : { submittedById: auth.user.id }), ...(status ? { status: status as never } : {}) },
    include: { submittedBy: { select: nameOnly }, mission: { select: { id: true, missionNo: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return (
    <>
      <PageHeader
        title="Flight plans"
        sub={all ? 'All flight plans. Ops approves submitted plans.' : 'Your flight plans.'}
        actions={auth.perms.has('flightplan.create') ? <a href="/flight-plans/new" className="btn-primary">New flight plan</a> : undefined}
      />
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {[undefined, 'SUBMITTED', 'APPROVED', 'DRAFT'].map((st) => (
          <a
            key={st ?? 'all'}
            href={`/flight-plans${st ? `?status=${st}` : ''}`}
            aria-current={status === st ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold no-underline ${status === st ? 'bg-navy text-white' : 'bg-white text-ink'}`}
          >
            {st ? st.charAt(0) + st.slice(1).toLowerCase() : 'All'}
          </a>
        ))}
      </nav>
      <Card bodyClass="">
        {plans.length === 0 ? (
          <Empty>No flight plans.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Mission</th>
                  <th>Pilot</th>
                  <th>EET</th>
                  <th>Fuel required</th>
                  <th>Filed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={`/flight-plans/${p.id}`} className="font-semibold no-underline">
                        {p.departure} → {p.destination}
                      </a>
                      <div className="text-ink-muted">Alt {p.alternate}</div>
                    </td>
                    <td>{p.mission ? <a href={`/missions/${p.mission.id}`} className="mono">{p.mission.missionNo}</a> : '—'}</td>
                    <td>{personName(p.submittedBy)}</td>
                    <td className="mono">{hm(p.estFlightTimeMin)}</td>
                    <td>{fuelLabel(p.fuelRequiredKg.toString(), p.fuelRequiredL.toString())}</td>
                    <td>{formatShortDate(p.createdAt)}</td>
                    <td>
                      <span className={TONE[p.status]}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</span>
                    </td>
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
