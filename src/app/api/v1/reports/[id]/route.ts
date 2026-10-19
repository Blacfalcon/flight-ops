import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api';

export const GET = route({ perm: 'summary.view' }, async ({ params }) => {
  const r = await db.summaryReport.findUnique({ where: { id: params.id } });
  if (!r) throw notFound('Report');
  return r;
});
