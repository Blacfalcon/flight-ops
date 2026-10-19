import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { nameOnly } from '@/lib/selects';
import { MISSION_CATEGORY_LABEL, ORDER_STATUS_LABEL, PRIORITY_LABEL, SEAT_LABEL, missionTypeLabel, personName, type SeatValue } from '@/lib/constants';
import { formatDateTime, formatShortDate, localTime } from '@/lib/time';
import { OrderDecision, PublishOne, UploadPdf } from '@/components/order-form';
import { Avatar } from '@/components/avatar';
import { Card, DefinitionGrid, PageHeader } from '@/components/ui';

export const metadata = { title: 'Mission order' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePage();
  const { id } = await params;
  const o = await db.missionOrder.findUnique({
    where: { id },
    include: {
      createdBy: { select: nameOnly },
      decidedBy: { select: nameOnly },
      mission: { include: { aircraft: true, crew: { include: { user: { select: nameOnly } } } } },
    },
  });
  if (!o) notFound();
  const onCrew = o.mission.crew.some((c) => c.userId === auth.user.id);
  if (!auth.perms.has('order.view') && !(onCrew && o.status === 'APPROVED' && o.mission.publishedAt)) notFound();

  const attachments = await db.attachment.findMany({ where: { entityType: 'mission_order', entityId: o.id }, orderBy: { createdAt: 'asc' } });
  const closed = ['COMPLETED', 'ABORTED', 'CANCELLED'].includes(o.mission.status);
  const canEdit = !closed && (o.mission.category === 'TRAINING' ? auth.perms.has('mission.createTraining') : auth.perms.has('mission.createOperational'));
  const canDecide = o.status === 'SUBMITTED' && auth.perms.has('order.approve') && !onCrew;
  const canPublish = auth.perms.has('mission.publish') && o.mission.status === 'DRAFT' && o.status === 'APPROVED';

  return (
    <>
      <PageHeader
        title={o.orderNo}
        back={{ href: '/mission-orders', label: 'Mission orders' }}
        sub={`For ${o.mission.missionNo} · ${MISSION_CATEGORY_LABEL[o.mission.category]} · ${missionTypeLabel(o.mission.type)} · ${o.mission.name}`}
        actions={
          <>
            <span className={o.status === 'APPROVED' ? 'pill-good' : o.status === 'REJECTED' ? 'pill-bad' : 'pill-warn'}>{ORDER_STATUS_LABEL[o.status]}</span>
            {canEdit && (
              <a href={`/missions/${o.missionId}/edit`} className="btn-secondary btn-sm">
                Edit with the sortie
              </a>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[2_1_480px]" title="Order">
          <div className="flex flex-col gap-4 text-[15px]">
            <DefinitionGrid
              items={[
                { label: 'Priority', value: PRIORITY_LABEL[o.priority] },
                { label: 'Raised by', value: `${personName(o.createdBy)} · ${formatDateTime(o.createdAt)}` },
                { label: 'Decision', value: o.decidedBy && o.decidedAt ? `${ORDER_STATUS_LABEL[o.status]} by ${personName(o.decidedBy)} · ${formatDateTime(o.decidedAt)}` : 'Awaiting CO Flying Wing or the Commander' },
                ...(o.decisionRemarks ? [{ label: 'Decision remarks', value: o.decisionRemarks }] : []),
              ]}
            />
            <div>
              <div className="label mb-0.5">Task</div>
              <p className="whitespace-pre-line">{o.taskDescription}</p>
            </div>
            <div>
              <div className="label mb-0.5">Objectives</div>
              <p className="whitespace-pre-line">{o.objectives}</p>
            </div>
            {o.operationalRemarks && (
              <div>
                <div className="label mb-0.5">Operational remarks</div>
                <p className="whitespace-pre-line">{o.operationalRemarks}</p>
              </div>
            )}
            {canDecide && <OrderDecision orderId={o.id} />}
            {canPublish && <PublishOne missionId={o.missionId} />}
          </div>
        </Card>
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
          <Card title="Assigned">
            <DefinitionGrid
              items={[
                { label: 'Aircraft', value: o.mission.aircraft.registration },
                { label: 'Take-off', value: `${formatShortDate(o.mission.takeoffAt)} ${localTime(o.mission.takeoffAt)}` },
              ]}
            />
            <div className="mt-4 flex flex-col gap-2">
              {o.mission.crew.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Avatar user={c.user} size={32} />
                  <div>
                    <div className="font-medium">{personName(c.user)}</div>
                    <div className="text-[12px] text-ink-muted">{SEAT_LABEL[c.seat as SeatValue]}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Attachments">
            <div className="flex flex-col gap-2">
              {attachments.map((a) => (
                <a key={a.id} href={`/api/v1/attachments/${a.id}`} target="_blank" rel="noopener" className="rounded-lg border border-line px-3 py-2.5 font-semibold no-underline">
                  {a.fileName} <span className="font-normal text-ink-muted">· {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                </a>
              ))}
              {attachments.length === 0 && <p className="text-ink-muted">No files attached.</p>}
              {auth.perms.has('order.manage') && !closed && (
                <div className="mt-2">
                  <UploadPdf orderId={o.id} />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
