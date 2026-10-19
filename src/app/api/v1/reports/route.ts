import { db } from '@/lib/db';
import { route } from '@/lib/api';
import { generateReportSchema } from '@/lib/validators';
import { generateSummary } from '@/lib/reports/generate';
import { audit } from '@/lib/audit';

export const GET = route({ perm: 'summary.view' }, async ({ query }) => {
  const period = query.get('period');
  return db.summaryReport.findMany({
    where: period ? { period: period as never } : {},
    select: { id: true, period: true, periodStart: true, periodEnd: true, generatedAt: true, pdfKey: true, xlsxKey: true },
    orderBy: [{ periodStart: 'desc' }],
    take: 100,
  });
});

/** Generate (or regenerate) a summary on demand, for example after late reports. */
export const POST = route({ perm: 'summary.export', schema: generateReportSchema }, async ({ auth, body }) => {
  const r = await generateSummary(body.period, body.anchor, { announce: false });
  await audit(auth.user.id, 'summary.generate', 'summary_report', r.id, { after: { period: body.period, anchor: body.anchor } });
  return { id: r.id };
});
