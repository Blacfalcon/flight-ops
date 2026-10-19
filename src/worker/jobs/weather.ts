import { db } from '../../lib/db';
import { notify, usersWithAppointments } from '../../lib/notify';
import { localDayBounds, localDate } from '../../lib/time';
import { expiresAt, isExpired } from '../../lib/weather/validity';

/**
 * When the latest METAR (1 hour) or TAF (its validity period) runs out while sorties are still
 * planned today, the Operations Officer is told once, so a current report is entered before
 * anyone plans or assesses risk on old weather.
 */
export async function weatherExpiry() {
  const now = new Date();
  const { end } = localDayBounds(localDate(now));
  const flying = await db.mission.count({
    where: { status: { in: ['DRAFT', 'AWAITING_ENGINEERING', 'PUBLISHED', 'CREW_READY', 'RISK_SUBMITTED', 'CLEARED'] }, landingAt: { gt: now }, takeoffAt: { lt: end } },
  });
  if (!flying) return;

  for (const kind of ['METAR', 'TAF'] as const) {
    const r = await db.weatherReport.findFirst({ where: { kind }, orderBy: { createdAt: 'desc' } });
    if (!r || !isExpired(r, now)) continue;
    const link = `/weather?expired=${r.id}`;
    if (await db.notification.findFirst({ where: { kind: 'weather.expired', link }, select: { id: true } })) continue;
    const ops = await usersWithAppointments(['OPERATIONS_OFFICER']);
    const at = expiresAt(r).toISOString().slice(11, 16);
    await notify(ops, { kind: 'weather.expired', title: `${kind} expired at ${at}Z — enter a current ${kind}`, link, email: true });
  }
}
