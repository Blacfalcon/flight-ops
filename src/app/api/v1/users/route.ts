import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { paging, route } from '@/lib/api';
import { publicUser } from '@/lib/selects';

export const GET = route({ perm: ['personnel.view', 'mission.createTraining'] }, async ({ query }) => {
  const where: Prisma.UserWhereInput = {};
  const q = query.get('q');
  if (q) where.OR = [{ fullName: { contains: q, mode: 'insensitive' } }, { nafNumber: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }];
  const appointment = query.get('appointment');
  if (appointment) where.appointment = appointment as never;
  const status = query.get('status');
  if (status) where.accountStatus = status as never;
  const pilots = query.get('pilots');
  if (pilots === '1') {
    where.flightStatus = { not: 'NONE' };
    where.accountStatus = 'ACTIVE';
  }
  const { skip, take, page, limit } = paging(query);
  const [items, total] = await Promise.all([
    db.user.findMany({ where, select: publicUser, orderBy: [{ appointment: 'asc' }, { fullName: 'asc' }], skip, take }),
    db.user.count({ where }),
  ]);
  return { items, total, page, limit };
});
