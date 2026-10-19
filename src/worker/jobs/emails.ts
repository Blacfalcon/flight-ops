import { db } from '../../lib/db';
import { sendAlertEmail } from '../../lib/mail';

/**
 * Items that need someone's action soon. These are emailed within a minute (one email per person
 * per run, however many are waiting). Everything else is emailed only to people who chose "All",
 * gathered into one email at most every hour. Everything always shows in the app.
 */
export const URGENT_KINDS = new Set([
  'readiness.request',
  'readiness.notAvailable',
  'readiness.noResponse',
  'imsafe.request',
  'risk.approvalRequest',
  'risk.reminder',
  'risk.rejected',
  'risk.levelChanged',
  'order.approvalRequest',
  'order.approved',
  'order.rejected',
  'order.updated',
  'mission.assigned',
  'mission.changed',
  'mission.cancelled',
  'mission.overdue',
  'aircraft.unavailable',
  'flightPlan.submitted',
  'user.awaitingActivation',
  'delegation.set',
]);

const DIGEST_MINUTES = 60;

export async function sendPendingEmails() {
  const pending = await db.notification.findMany({
    where: { emailRequested: true, emailedAt: null, createdAt: { gt: new Date(Date.now() - 24 * 3_600_000) } },
    include: { user: { select: { email: true, accountStatus: true, emailAlerts: true } } },
    take: 500,
    orderBy: { createdAt: 'asc' },
  });

  type Entry = { email: string; active: boolean; pref: string; urgent: typeof pending; other: typeof pending };
  const byUser = new Map<string, Entry>();
  for (const n of pending) {
    const e = byUser.get(n.userId) ?? { email: n.user.email, active: n.user.accountStatus === 'ACTIVE', pref: n.user.emailAlerts, urgent: [], other: [] };
    (URGENT_KINDS.has(n.kind) ? e.urgent : e.other).push(n);
    byUser.set(n.userId, e);
  }

  const now = Date.now();
  for (const [, e] of byUser) {
    const skip: string[] = []; // marked done without an email
    const send: string[] = [];
    let urgent = false;

    if (!e.active || e.pref === 'NONE') {
      skip.push(...e.urgent.map((n) => n.id), ...e.other.map((n) => n.id));
    } else {
      if (e.urgent.length) {
        urgent = true;
        send.push(...e.urgent.map((n) => n.id));
      }
      if (e.pref === 'ALL') {
        // Wait until the oldest non-urgent item is an hour old, or ride along with an urgent email
        const oldest = e.other[0]?.createdAt.getTime();
        if (oldest !== undefined && (urgent || now - oldest >= DIGEST_MINUTES * 60_000)) send.push(...e.other.map((n) => n.id));
      } else {
        skip.push(...e.other.map((n) => n.id));
      }
    }

    try {
      if (send.length) await sendAlertEmail(e.email, send.length, urgent);
      const done = [...send, ...skip];
      if (done.length) await db.notification.updateMany({ where: { id: { in: done } }, data: { emailedAt: new Date() } });
    } catch (err) {
      console.error('email send failed; will retry next run', err);
    }
  }
}
