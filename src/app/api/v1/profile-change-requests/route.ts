import { db } from '@/lib/db';
import { route } from '@/lib/api';
import { nameOnly } from '@/lib/selects';

export const GET = route({ perm: 'changeRequest.decide' }, async ({ query }) => {
  const status = (query.get('status') ?? 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED';
  return db.profileChangeRequest.findMany({
    where: { status },
    include: { user: { select: nameOnly }, decidedBy: { select: nameOnly } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
});
