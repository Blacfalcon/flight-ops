import { forbidden, route } from '@/lib/api';
import { missionSchema } from '@/lib/validators';
import { createMission } from '@/lib/services/missions';
import { listMissions, toMissionInput } from '@/lib/services/mission-queries';

export const GET = route({}, async ({ auth, query }) => {
  const seesAll = auth.perms.has('schedule.viewAll');
  const mine = query.get('mine') === '1' || !seesAll;
  return listMissions({
    date: query.get('date') ?? undefined,
    from: query.get('from') ?? undefined,
    to: query.get('to') ?? undefined,
    userId: mine ? auth.user.id : undefined,
    includeDrafts: auth.perms.has('mission.createTraining') && !mine,
  });
});

export const POST = route({ perm: ['mission.createTraining', 'mission.createOperational'], schema: missionSchema }, async ({ auth, body }) => {
  if (body.category === 'TRAINING' ? !auth.perms.has('mission.createTraining') : !auth.perms.has('mission.createOperational')) {
    throw forbidden('You can only create training schedules.');
  }
  return createMission(toMissionInput(body), auth.user.id);
});
