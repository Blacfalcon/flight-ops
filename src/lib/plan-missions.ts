import { db } from './db';
import { formatShortDate, localTime } from './time';

/** Open missions the person is crewed on, for linking a flight plan */
export async function myOpenMissions(userId: string) {
  const ms = await db.mission.findMany({
    where: { crew: { some: { userId } }, status: { in: ['PUBLISHED', 'CREW_READY', 'RISK_SUBMITTED', 'CLEARED'] } },
    orderBy: { takeoffAt: 'asc' },
    take: 50,
  });
  return ms.map((m) => ({ id: m.id, label: `${m.missionNo} · ${formatShortDate(m.takeoffAt)} ${localTime(m.takeoffAt)} · ${m.name}` }));
}
