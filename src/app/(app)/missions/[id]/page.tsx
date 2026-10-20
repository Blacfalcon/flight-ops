import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { loadMissionDetail } from '@/lib/services/mission-queries';
import { pilotInCommandSeat } from '@/lib/rules/pairing';
import { MISSION_CATEGORY_LABEL, ORDER_STATUS_LABEL, PRIORITY_LABEL, SEAT_LABEL, missionTypeLabel, personName, type SeatValue } from '@/lib/constants';
import { OrderDecision, PublishOne } from '@/components/order-form';
import { formatDateTime } from '@/lib/time';
import { CrewAvatar } from '@/components/avatar';
import { countdown, formatLongDate, hm, localDate, localTime, zuluTime } from '@/lib/time';
import { fuelLabel } from '@/lib/fuel';
import { AircraftStatusPill, Card, DefinitionGrid, Empty, MissionStatusPill, PageHeader, ReadinessPill } from '@/components/ui';
import { ApprovalSummary } from '@/components/approval-card';
import { ReadinessButtons } from '@/components/mission/readiness-buttons';
import { CloseOutForm } from '@/components/mission/close-out-form';
import { CancelMission } from '@/components/mission/cancel-mission';
import { getSettings } from '@/lib/settings';
import { approverHolders } from '@/lib/services/approvers';
import { orderNeedsSelfAuth, selfAuthWarning, type ApproverRoleKey } from '@/lib/rules/approvals';

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePage();
  const { id } = await params;
  const m = await loadMissionDetail(id);
  if (!m) notFound();
  const me = m.crew.find((c) => c.userId === auth.user.id);
  if (!me && !auth.perms.has('schedule.viewAll')) notFound();

  const attachments = m.order ? await db.attachment.findMany({ where: { entityType: 'mission_order', entityId: m.order.id } }) : [];
  const ra = m.riskAssessments.find((r) => r.status !== 'WITHDRAWN') ?? null;
  const picSeat = pilotInCommandSeat(m.crew.map((c) => c.seat));
  const iAmPic = !!me && me.seat === picSeat;
  const closed = ['COMPLETED', 'ABORTED', 'CANCELLED'].includes(m.status);
  const canEdit = !closed && (m.category === 'TRAINING' ? auth.perms.has('mission.createTraining') : auth.perms.has('mission.createOperational'));
  const plan = m.flightPlans[0] ?? null;
  const today = localDate() === localDate(m.takeoffAt);
  const needMyImsafe = !!me && ra?.status === 'SUBMITTED' && !ra.imsafe.some((i) => i.userId === me.userId);

  const order = m.order;
  const crewIds = m.crew.map((c) => c.userId);
  const holders = closed ? [] : await approverHolders();
  const orderSelfAuth = !!me && !!order && order.status === 'SUBMITTED' && auth.perms.has('order.approve') && orderNeedsSelfAuth(holders, crewIds);
  const canDecideOrder = !!order && order.status === 'SUBMITTED' && auth.perms.has('order.approve') && (!me || orderSelfAuth);
  const selfAuthNote = closed ? null : selfAuthWarning(holders, crewIds, (await getSettings()).requiredApprovers as ApproverRoleKey[]);
  const canPublish = auth.perms.has('mission.publish') && m.status === 'DRAFT' && order?.status === 'APPROVED';
  const steps = [
    { label: 'Order approved', done: order?.status === 'APPROVED' },
    { label: 'Engineering', done: m.status !== 'AWAITING_ENGINEERING' && m.aircraft.status === 'SERVICEABLE' },
    { label: 'Published', done: !!m.publishedAt },
    { label: 'Crew ready', done: m.crew.length > 0 && m.crew.every((c) => c.readiness === 'READY') },
    { label: 'Risk cleared', done: ra?.status === 'CLEARED' },
    { label: 'Closed', done: m.status === 'COMPLETED' || m.status === 'ABORTED' },
  ];

  return (
    <>
      <PageHeader
        back={{ href: auth.perms.has('schedule.viewAll') ? `/schedule?date=${localDate(m.takeoffAt)}` : '/missions', label: auth.perms.has('schedule.viewAll') ? 'Schedule' : 'My missions' }}
        title={m.missionNo}
        sub={
          <span>
            {MISSION_CATEGORY_LABEL[m.category]} · {missionTypeLabel(m.type)} · {m.name} · {formatLongDate(localDate(m.takeoffAt))}
          </span>
        }
        actions={
          <>
            <MissionStatusPill status={m.status} takeoffAt={m.takeoffAt} landingAt={m.landingAt} />
            {today && !closed && <span className="font-mono font-medium text-warn-fg">{countdown(m.takeoffAt)}</span>}
            {canEdit && (
              <a href={`/missions/${m.id}/edit`} className="btn-secondary btn-sm">
                Edit
              </a>
            )}
            {!closed && auth.perms.has('mission.cancel') && <CancelMission missionId={m.id} />}
          </>
        }
      />

      <ol className="flex flex-wrap gap-2" aria-label="Mission gates">
        {steps.map((s, i) => (
          <li key={s.label} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${s.done ? 'bg-good-bg text-good-fg' : 'bg-[#EEF1F5] text-ink-muted'}`}>
            <span aria-hidden="true">{s.done ? '✓' : i + 1}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {m.status === 'CANCELLED' && <div className="alert-bad">Cancelled: {m.cancelReason}</div>}
      {selfAuthNote && <div className="alert-warn">{selfAuthNote}</div>}
      {m.status === 'AWAITING_ENGINEERING' && <div className="alert-warn">Waiting for CO Engineering to confirm {m.aircraft.registration} serviceable for this date.</div>}

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-6">
          <Card title="Mission details">
            <DefinitionGrid
              items={[
                { label: 'Aircraft', value: <span className="flex items-center gap-2"><span className="font-mono">{m.aircraft.registration}</span><AircraftStatusPill status={m.aircraft.status} /></span> },
                { label: 'Type', value: m.aircraft.type },
                { label: 'Briefing', value: <span className="font-mono">{localTime(m.briefingAt)} · {zuluTime(m.briefingAt)}</span> },
                { label: 'Take-off', value: <span className="font-mono">{localTime(m.takeoffAt)} · {zuluTime(m.takeoffAt)}</span> },
                { label: 'Landing (planned)', value: <span className="font-mono">{localTime(m.landingAt)} · {zuluTime(m.landingAt)}</span> },
                { label: 'Scheduled by', value: personName(m.createdBy) },
              ]}
            />
          </Card>

          <Card title="Crew and readiness" bodyClass="">
            {m.crew.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF1F5] px-5 py-3 first:border-0">
                <div className="flex items-center gap-3">
                  <CrewAvatar user={c.user} />
                  <div>
                  <div className="font-medium">{personName(c.user)}</div>
                  <div className="text-[12px] text-ink-muted">
                    {SEAT_LABEL[c.seat as SeatValue]}
                    {c.seat === picSeat ? ' · pilot in command' : ''}
                    {c.readinessReason ? ` · ${c.readinessReason}` : ''}
                  </div>
                  </div>
                </div>
                <ReadinessPill value={c.readiness} />
              </div>
            ))}
            {me && me.readiness !== 'READY' && ['PUBLISHED', 'CREW_READY'].includes(m.status) && (
              <div className="border-t border-line px-5 py-4">
                <ReadinessButtons missionId={m.id} missionNo={m.missionNo} />
              </div>
            )}
          </Card>

          <Card title="Risk assessment" actions={ra && auth.perms.has('risk.view') ? <a href={`/risk/${ra.id}`} className="text-[13px] font-semibold">Full assessment</a> : undefined}>
            {ra ? (
              <div className="flex flex-col gap-4">
                {ra.status === 'REJECTED' && <div className="alert-bad">Rejected. The pilot in command can revise and resubmit.</div>}
                <ApprovalSummary ra={{ ...ra, mission: m }} />
              </div>
            ) : (
              <Empty>Not submitted yet. The pilot in command submits it once the whole crew is READY; it is due by T-30.</Empty>
            )}
            {iAmPic && m.status === 'CREW_READY' && (!ra || ra.status === 'REJECTED') && (
              <a href={`/missions/${m.id}/risk`} className="btn-primary mt-4 w-full">
                {ra?.status === 'REJECTED' ? 'Revise and resubmit' : 'Complete risk assessment'}
              </a>
            )}
            {needMyImsafe && (
              <a href={`/missions/${m.id}/risk`} className="btn-primary mt-4 w-full">
                Add my IMSAFE check
              </a>
            )}
          </Card>

          {me && !closed && m.status !== 'AWAITING_ENGINEERING' && m.status !== 'DRAFT' && (
            <Card title="Close the mission">
              <CloseOutForm missionId={m.id} missionNo={m.missionNo} canComplete={m.status === 'CLEARED'} />
            </Card>
          )}

          {m.report && (
            <Card title={m.report.outcome === 'COMPLETED' ? 'Mission completed' : 'Mission aborted'}>
              <DefinitionGrid
                items={[
                  { label: 'Flight time', value: <span className="font-mono">{hm(m.report.flightTimeMin)}</span> },
                  { label: 'Fuel used', value: fuelLabel(m.report.fuelUsedKg.toString(), m.report.fuelUsedL.toString()) },
                  { label: 'Submitted by', value: personName(m.report.submittedBy) },
                  ...(m.report.abortReason ? [{ label: 'Abort reason', value: m.report.abortReason }] : []),
                  ...(m.report.missionOutcome ? [{ label: 'Outcome', value: m.report.missionOutcome }] : []),
                  { label: 'Remarks', value: m.report.remarks },
                ]}
              />
              {m.report.snags.length > 0 && (
                <div className="mt-4">
                  <div className="label">Snags raised</div>
                  <ul className="ml-5 list-disc">
                    {m.report.snags.map((s) => (
                      <li key={s.id}>
                        {s.description} <span className={s.status === 'OPEN' ? 'pill-warn' : 'pill-good'}>{s.status === 'OPEN' ? 'Open' : 'Closed'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <Card
            title="Mission order"
            actions={
              canEdit ? (
                <a href={`/missions/${m.id}/edit`} className="btn-outline btn-sm">
                  {order ? 'Edit' : 'Add order'}
                </a>
              ) : undefined
            }
          >
            {order ? (
              <div className="flex flex-col gap-3 text-[14px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={`/mission-orders/${order.id}`} className="mono no-underline">
                    {order.orderNo}
                  </a>
                  <span className="flex gap-1.5">
                    <span className={order.priority === 'IMMEDIATE' ? 'pill-bad' : order.priority === 'PRIORITY' ? 'pill-warn' : 'pill-none'}>{PRIORITY_LABEL[order.priority]}</span>
                    <span className={order.status === 'APPROVED' ? 'pill-good' : order.status === 'REJECTED' ? 'pill-bad' : 'pill-warn'}>{ORDER_STATUS_LABEL[order.status]}</span>
                  </span>
                </div>
                {order.decidedBy && order.decidedAt && (
                  <p className="text-[13px] text-ink-muted">
                    {order.status === 'APPROVED' ? 'Approved' : order.status === 'REJECTED' ? 'Returned' : 'Last decided'} by {personName(order.decidedBy)}
                    {order.selfAuthorised ? ' (self-authorised)' : ''} · {formatDateTime(order.decidedAt)}
                    {order.decisionRemarks ? ` — “${order.decisionRemarks}”` : ''}
                  </p>
                )}
                <div>
                  <div className="label mb-0.5">Task</div>
                  <p className="whitespace-pre-line">{order.taskDescription}</p>
                </div>
                <div>
                  <div className="label mb-0.5">Objectives</div>
                  <p className="whitespace-pre-line">{order.objectives}</p>
                </div>
                {order.operationalRemarks && (
                  <div>
                    <div className="label mb-0.5">Remarks</div>
                    <p className="whitespace-pre-line">{order.operationalRemarks}</p>
                  </div>
                )}
                {attachments.map((a) => (
                  <a key={a.id} href={`/api/v1/attachments/${a.id}`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-lg border border-line px-3 py-2.5 no-underline">
                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#1F5FD1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <path d="M14 3v6h6" />
                    </svg>
                    <span className="font-semibold">{a.fileName}</span>
                  </a>
                ))}
                {canDecideOrder && <OrderDecision orderId={order.id} selfAuth={orderSelfAuth} />}
                {canPublish && <PublishOne missionId={m.id} />}
                {auth.perms.has('mission.publish') && m.status === 'DRAFT' && order.status !== 'APPROVED' && (
                  <p className="text-[13px] text-ink-muted">You can publish once CO Flying Wing or the Commander approves this order.</p>
                )}
              </div>
            ) : (
              <Empty>No mission order yet. Every sortie needs one before it can be published{canEdit ? ' — use Add order' : ''}.</Empty>
            )}
          </Card>

          <Card
            title="Flight plan"
            actions={
              me && !closed ? (
                <a href={plan && plan.status !== 'APPROVED' && plan.submittedById === auth.user.id ? `/flight-plans/${plan.id}` : `/flight-plans/new?missionId=${m.id}`} className="btn-outline btn-sm">
                  {plan && plan.status !== 'APPROVED' && plan.submittedById === auth.user.id ? 'Edit plan' : 'File plan'}
                </a>
              ) : undefined
            }
          >
            {plan ? (
              <div className="flex flex-col gap-2 text-[14px]">
                <div className="flex items-center justify-between">
                  <a href={`/flight-plans/${plan.id}`} className="font-semibold">
                    {plan.departure} → {plan.destination}
                  </a>
                  <span className={plan.status === 'APPROVED' ? 'pill-good' : plan.status === 'SUBMITTED' ? 'pill-warn' : 'pill-none'}>{plan.status.charAt(0) + plan.status.slice(1).toLowerCase()}</span>
                </div>
                <div className="text-ink-muted">
                  EET {hm(plan.estFlightTimeMin)} · Alt {plan.alternate} · {fuelLabel(plan.fuelRequiredKg.toString(), plan.fuelRequiredL.toString())}
                </div>
              </div>
            ) : (
              <Empty>No flight plan filed.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
