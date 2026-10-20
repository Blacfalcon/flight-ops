import type { Prisma } from '@prisma/client';
import { db } from '../db';
import { personName } from '../constants';
import type { ApproverHolder, ApproverRoleKey } from '../rules/approvals';

type Tx = Prisma.TransactionClient | typeof db;

/** Everyone who can approve orders and risk assessments right now (GOO included while acting Commander). */
export async function approverHolders(tx: Tx = db, at: Date = new Date()): Promise<ApproverHolder[]> {
  const [users, acting] = await Promise.all([
    tx.user.findMany({
      where: { accountStatus: 'ACTIVE', appointment: { in: ['COMMANDER', 'CO_FLYING_WING'] } },
      select: { id: true, rank: true, fullName: true, appointment: true },
    }),
    tx.delegation.findMany({
      where: { cancelledAt: null, startsAt: { lte: at }, endsAt: { gt: at }, toUser: { accountStatus: 'ACTIVE' } },
      select: { toUser: { select: { id: true, rank: true, fullName: true } } },
    }),
  ]);
  const out = new Map<string, ApproverHolder>();
  const add = (u: { id: string; rank: string; fullName: string }, role: ApproverRoleKey) => {
    const h = out.get(u.id) ?? { id: u.id, name: personName(u), roles: [] };
    if (!h.roles.includes(role)) h.roles.push(role);
    out.set(u.id, h);
  };
  for (const u of users) add(u, u.appointment === 'COMMANDER' ? 'COMMANDER' : 'CO_FLYING_WING');
  for (const d of acting) add(d.toUser, 'COMMANDER');
  return [...out.values()];
}
