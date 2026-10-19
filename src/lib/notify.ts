import { Prisma } from '@prisma/client';
import { db } from './db';

// In-app notifications. When `email` is true the worker sends a minimal "sign in to view" email
// within a minute (see worker/jobs/emails.ts); the email itself carries no detail.

type Tx = Prisma.TransactionClient | typeof db;

export type NotifyInput = {
  kind: string;
  title: string;
  body?: string;
  link?: string;
  email?: boolean;
};

export async function notify(userIds: string[], n: NotifyInput, tx: Tx = db) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  await tx.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
      emailRequested: !!n.email,
    })),
  });
}

/** Active users holding any of these appointments (GOO included when acting as Commander) */
export async function usersWithAppointments(appointments: string[], tx: Tx = db): Promise<string[]> {
  const users = await tx.user.findMany({
    where: { accountStatus: 'ACTIVE', appointment: { in: appointments as never[] } },
    select: { id: true },
  });
  const ids: string[] = users.map((u) => u.id);
  if (appointments.includes('COMMANDER')) {
    const now = new Date();
    const acting = await tx.delegation.findMany({
      where: { cancelledAt: null, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { toUserId: true },
    });
    ids.push(...acting.map((a) => a.toUserId));
  }
  return [...new Set(ids)];
}
