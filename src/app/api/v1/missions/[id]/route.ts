import { db } from '@/lib/db';
import { forbidden, notFound, route } from '@/lib/api';
import { missionSchema } from '@/lib/validators';
import { updateMission } from '@/lib/services/missions';
import { loadMissionDetail, toMissionInput } from '@/lib/services/mission-queries';

export const GET = route({}, async ({ auth, params }) => {
  const m = await loadMissionDetail(params.id);
  if (!m) throw notFound('Mission');
  if (!auth.perms.has('schedule.viewAll') && !m.crew.some((c) => c.userId === auth.user.id)) throw forbidden();
  return m;
});

export const PATCH = route({ perm: ['mission.createTraining', 'mission.createOperational'], schema: missionSchema }, async ({ auth, params, body }) => {
  const existing = await db.mission.findUnique({ where: { id: params.id }, select: { category: true } });
  if (!existing) throw notFound('Mission');
  const needsOps = body.category !== 'TRAINING' || existing.category !== 'TRAINING';
  if (needsOps && !auth.perms.has('mission.createOperational')) throw forbidden('Only the Operations Officer can change operational missions.');
  return updateMission(params.id, toMissionInput(body), auth.user.id);
});
