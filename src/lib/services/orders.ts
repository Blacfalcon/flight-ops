import type { MissionOrder, Prisma } from '@prisma/client';
import { db } from '../db';
import { conflict, forbidden, invalid, notFound } from '../api-errors';
import { audit } from '../audit';
import { notify, usersWithAppointments } from '../notify';

// Every sortie has a mission order. It is raised together with the schedule entry, approved by
// CO Flying Wing or the Commander (either one), and only then can the Ops Officer publish the sortie.

type Tx = Prisma.TransactionClient;

export type OrderFields = {
  taskDescription: string;
  objectives: string;
  priority: 'ROUTINE' | 'PRIORITY' | 'IMMEDIATE';
  operationalRemarks: string | null;
};

export const ORDER_APPROVERS = ['COMMANDER', 'CO_FLYING_WING'];

export async function nextOrderNo(tx: Tx, date: string): Promise<string> {
  const prefix = `MO-${date.slice(2, 4)}-`;
  const last = await tx.missionOrder.findFirst({ where: { orderNo: { startsWith: prefix } }, orderBy: { orderNo: 'desc' }, select: { orderNo: true } });
  return `${prefix}${String((last ? Number(last.orderNo.slice(prefix.length)) : 0) + 1).padStart(3, '0')}`;
}

export async function notifyApprovers(tx: Tx, missionId: string, missionNo: string, orderNo: string, resubmitted: boolean) {
  const ids = await usersWithAppointments(ORDER_APPROVERS, tx);
  await notify(
    ids,
    {
      kind: 'order.approvalRequest',
      title: resubmitted ? `${orderNo} (${missionNo}) changed — approve again` : `${orderNo} (${missionNo}) awaiting your approval`,
      link: `/missions/${missionId}`,
      email: true,
    },
    tx,
  );
}

export function orderChanged(before: Pick<MissionOrder, 'taskDescription' | 'objectives' | 'priority' | 'operationalRemarks'>, after: OrderFields): boolean {
  return (
    before.taskDescription !== after.taskDescription ||
    before.objectives !== after.objectives ||
    before.priority !== after.priority ||
    (before.operationalRemarks ?? null) !== (after.operationalRemarks ?? null)
  );
}

/** CO Flying Wing or the Commander approves or returns a mission order. */
export async function decideOrder(args: { orderId: string; userId: string; decision: 'APPROVE' | 'REJECT'; remarks?: string }) {
  return db.$transaction(async (tx) => {
    const o = await tx.missionOrder.findUnique({ where: { id: args.orderId }, include: { mission: { include: { crew: true } } } });
    if (!o) throw notFound('Mission order');
    if (o.status !== 'SUBMITTED') throw conflict('This mission order is not awaiting approval.');
    if (o.mission.crew.some((c) => c.userId === args.userId)) throw forbidden('You cannot approve a mission you are crewed on.');
    if (args.decision === 'REJECT' && !args.remarks?.trim()) throw invalid('Say what needs to change.', { remarks: 'Required when returning an order.' });

    const status = args.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const after = await tx.missionOrder.update({
      where: { id: o.id },
      data: { status, decidedById: args.userId, decidedAt: new Date(), decisionRemarks: args.remarks?.trim() || null },
    });
    const staff = await usersWithAppointments(['OPERATIONS_OFFICER', 'TRAINING_OFFICER'], tx);
    await notify(
      [...staff, o.createdById],
      {
        kind: status === 'APPROVED' ? 'order.approved' : 'order.rejected',
        title: status === 'APPROVED' ? `${o.orderNo} (${o.mission.missionNo}) approved — ready to publish` : `${o.orderNo} (${o.mission.missionNo}) returned — revise and resubmit`,
        link: `/missions/${o.missionId}`,
        email: true,
      },
      tx,
    );
    // An order that changed after publication: tell the crew the approved version stands again
    if (status === 'APPROVED' && o.mission.publishedAt) {
      await notify(o.mission.crew.map((c) => c.userId), { kind: 'order.updated', title: `Mission order ${o.orderNo} updated`, link: `/missions/${o.missionId}`, email: true }, tx);
    }
    await audit(args.userId, `order.${args.decision.toLowerCase()}`, 'mission_order', o.id, { before: { status: o.status }, after: { status, remarks: args.remarks } }, tx);
    return after;
  });
}
