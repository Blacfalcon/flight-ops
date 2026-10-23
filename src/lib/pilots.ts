import { db } from './db';
import { personName } from './constants';

/** Active pilots for crew drop-downs */
export async function activePilots() {
  const users = await db.user.findMany({
    where: { accountStatus: 'ACTIVE', flightStatus: { not: 'NONE' } },
    select: { id: true, rank: true, fullName: true, flightStatus: true, pilotCategory: true },
    orderBy: [{ rank: 'desc' }, { surname: 'asc' }, { fullName: 'asc' }],
  });
  return users.map((u) => ({ id: u.id, name: personName(u), flightStatus: u.flightStatus, pilotCategory: u.pilotCategory }));
}
