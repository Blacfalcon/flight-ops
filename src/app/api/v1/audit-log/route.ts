import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { paging, route } from '@/lib/api';
import { nameOnly } from '@/lib/selects';

export const GET = route({ perm: 'audit.view' }, async ({ query }) => {
  const where: Prisma.AuditLogWhereInput = {};
  const actor = query.get('actorId');
  const entity = query.get('entityType');
  const action = query.get('action');
  const from = query.get('from');
  if (actor) where.actorId = actor;
  if (entity) where.entityType = entity;
  if (action) where.action = { contains: action };
  if (from) where.createdAt = { gte: new Date(from) };
  const { skip, take, page, limit } = paging(query);
  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, include: { actor: { select: nameOnly } }, orderBy: { createdAt: 'desc' }, skip, take }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, page, limit };
});
