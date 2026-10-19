import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { pilotInCommandSeat } from '@/lib/rules/pairing';
import { weatherSuggestion } from '@/lib/services/risk';
import { getSettings } from '@/lib/settings';
import { localTime } from '@/lib/time';
import { PageHeader } from '@/components/ui';
import { RiskForm } from '@/components/risk/risk-form';
import { ImsafeForm } from '@/components/risk/imsafe-form';

export const metadata = { title: 'Risk assessment' };

export default async function MissionRiskPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePage('risk.submit');
  const { id } = await params;
  const m = await db.mission.findUnique({
    where: { id },
    include: { crew: true, aircraft: true, riskAssessments: { orderBy: { version: 'desc' }, take: 1, include: { imsafe: true } } },
  });
  if (!m) notFound();
  const me = m.crew.find((c) => c.userId === auth.user.id);
  if (!me) notFound();

  const pic = pilotInCommandSeat(m.crew.map((c) => c.seat));
  const latest = m.riskAssessments[0];
  const open = latest?.status === 'SUBMITTED' ? latest : null;
  const header = (
    <PageHeader back={{ href: `/missions/${m.id}`, label: m.missionNo }} title="Risk assessment" sub={`${m.missionNo} · ${m.aircraft.registration} · take-off ${localTime(m.takeoffAt)} · due by T-30`} />
  );

  if (open) {
    const mine = open.imsafe.find((i) => i.userId === auth.user.id);
    return (
      <>
        {header}
        {mine ? (
          <div className="alert-good">Your IMSAFE check is in. The assessment is with the approvers.</div>
        ) : (
          <ImsafeForm riskId={open.id} missionNo={m.missionNo} />
        )}
      </>
    );
  }

  if (me.seat !== pic) {
    return (
      <>
        {header}
        <div className="alert-info">The pilot in command submits the risk assessment. You will be asked for your IMSAFE check once it is submitted.</div>
      </>
    );
  }
  if (m.status !== 'CREW_READY') {
    return (
      <>
        {header}
        <div className="alert-warn">
          {m.status === 'PUBLISHED' ? 'The whole crew must confirm READY first.' : m.status === 'CLEARED' ? 'This mission is already cleared to fly.' : 'The risk assessment cannot be submitted in the mission’s current state.'}
        </div>
      </>
    );
  }

  const [weather, settings] = await Promise.all([weatherSuggestion(m.takeoffAt), getSettings()]);
  return (
    <>
      {header}
      {!weather.current && (
        <div className="alert-bad">
          {weather.note}. You can fill in the form, but it can’t be submitted until a current METAR is entered.
        </div>
      )}
      {latest?.status === 'REJECTED' && <div className="alert-bad">The previous version was rejected. Review the approvers’ remarks on the mission page, then resubmit.</div>}
      <RiskForm
        missionId={m.id}
        missionNo={m.missionNo}
        thresholds={settings.riskThresholds}
        weather={{ rating: weather.rating, note: weather.note, metar: weather.metarRaw, current: weather.current }}
        crewCount={m.crew.length}
      />
    </>
  );
}
