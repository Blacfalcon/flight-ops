import { db } from '@/lib/db';
import { forbidden, invalid, notFound, route } from '@/lib/api';
import { getObject } from '@/lib/storage';
import { summaryToPdf, summaryToXlsx } from '@/lib/reports/export';
import type { SummaryFigures } from '@/lib/reports/summary';
import { getSettings } from '@/lib/settings';
import { audit } from '@/lib/audit';

// Full exports: Operations Officer, CO Flying Wing and the Commander (or acting GOO).
// Safety Officer: the safety extract only (format=pdf&part=safety). Everyone else views on screen.
export const GET = route({ perm: ['summary.export', 'summary.exportSafety'] }, async ({ auth, params, query }) => {
  const format = query.get('format');
  const part = query.get('part') === 'safety' ? 'safety' : 'all';
  if (format !== 'pdf' && format !== 'xlsx') throw invalid('Use format=pdf or format=xlsx.');
  if (!auth.perms.has('summary.export') && !(part === 'safety' && format === 'pdf')) throw forbidden('You can export the safety extract (PDF) only.');
  const r = await db.summaryReport.findUnique({ where: { id: params.id } });
  if (!r) throw notFound('Report');

  const { unit } = await getSettings();
  const key = part === 'all' ? (format === 'pdf' ? r.pdfKey : r.xlsxKey) : null;
  let body: Uint8Array;
  if (key) {
    body = (await getObject(key)).body;
  } else {
    const figures = r.figures as unknown as SummaryFigures;
    body = format === 'pdf' ? await summaryToPdf(figures, unit, { part }) : await summaryToXlsx(figures, unit);
  }
  const slug = unit.short.replace(/[^A-Za-z0-9]+/g, '');
  const name = `${slug}-${r.period.toLowerCase()}${part === 'safety' ? '-safety' : ''}-${r.periodStart.toISOString().slice(0, 10)}.${format}`;
  await audit(auth.user.id, 'summary.export', 'summary_report', r.id, { after: { format, part } });
  return new Response(Buffer.from(body), {
    headers: {
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
