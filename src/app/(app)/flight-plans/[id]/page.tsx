import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { myOpenMissions } from '@/lib/plan-missions';
import { personName } from '@/lib/constants';
import { formatDateTime, hm } from '@/lib/time';
import { fuelLabel } from '@/lib/fuel';
import { FlightPlanForm } from '@/components/flight-plan-form';
import { ApprovePlan } from '@/components/approve-plan';
import { Card, DefinitionGrid, PageHeader } from '@/components/ui';

export const metadata = { title: 'Flight Plan' };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePage(['flightplan.viewAll', 'flightplan.create']);
  const { id } = await params;
  const p = await db.flightPlan.findUnique({
    where: { id },
    include: { submittedBy: { select: nameOnly }, approvedBy: { select: nameOnly }, mission: { select: { id: true, missionNo: true } } },
  });
  if (!p) notFound();
  const mine = p.submittedById === auth.user.id;
  if (!mine && !auth.perms.has('flightplan.viewAll')) notFound();
  const editable = mine && p.status !== 'APPROVED';
  const tone = p.status === 'APPROVED' ? 'pill-good' : p.status === 'SUBMITTED' ? 'pill-warn' : 'pill-none';

  return (
    <>
      <PageHeader
        back={{ href: '/flight-plans', label: 'Flight Plans' }}
        title={`${p.departure} → ${p.destination}`}
        sub={`Filed by ${personName(p.submittedBy)} · ${formatDateTime(p.createdAt)}`}
        actions={
          <>
            <span className={tone}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</span>
            {p.status === 'SUBMITTED' && auth.perms.has('flightplan.approve') && <ApprovePlan planId={p.id} />}
          </>
        }
      />
      {editable ? (
        <Card title="Edit Plan">
          <FlightPlanForm
            missions={await myOpenMissions(auth.user.id)}
            initial={{
              id: p.id,
              missionId: p.missionId ?? '',
              departure: p.departure,
              destination: p.destination,
              route: p.route,
              alternate: p.alternate,
              eetHours: String(Math.floor(p.estFlightTimeMin / 60)),
              eetMinutes: String(p.estFlightTimeMin % 60),
              fuelRequired: p.fuelRequiredKg.toString(),
              fuelUnit: 'kg',
              crewNotes: p.crewNotes ?? '',
            }}
          />
        </Card>
      ) : (
        <Card title="Plan">
          <DefinitionGrid
            items={[
              { label: 'Departure', value: p.departure },
              { label: 'Destination', value: p.destination },
              { label: 'Alternate', value: p.alternate },
              { label: 'Estimated flight time', value: hm(p.estFlightTimeMin) },
              { label: 'Fuel required', value: fuelLabel(p.fuelRequiredKg.toString(), p.fuelRequiredL.toString()) },
              { label: 'Mission', value: p.mission ? <a href={`/missions/${p.mission.id}`}>{p.mission.missionNo}</a> : '—' },
              { label: 'Approved by', value: p.approvedBy ? `${personName(p.approvedBy)}${p.approvedAt ? ` · ${formatDateTime(p.approvedAt)}` : ''}` : '—' },
            ]}
          />
          <div className="mt-4">
            <div className="label">Route</div>
            <p className="whitespace-pre-line">{p.route}</p>
          </div>
          {p.crewNotes && (
            <div className="mt-4">
              <div className="label">Crew details and notes</div>
              <p className="whitespace-pre-line">{p.crewNotes}</p>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
