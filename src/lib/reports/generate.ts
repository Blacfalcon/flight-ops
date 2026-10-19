import type { SummaryPeriod } from '@prisma/client';
import { db } from '../db';
import { computeSummary, periodRange } from './summary';
import { summaryToPdf, summaryToXlsx } from './export';
import { putObject } from '../storage';
import { notify, usersWithAppointments } from '../notify';
import { dateOnly } from '../time';
import { getSettings } from '../settings';

/** Build, store and announce a summary. Safe to re-run: it replaces the stored copy for that period. */
export async function generateSummary(period: SummaryPeriod, anchor: string, opts: { announce?: boolean } = {}) {
  const { start, end } = periodRange(period, anchor);
  const figures = await computeSummary(period, start, end);
  const base = `reports/${period.toLowerCase()}/${start}`;

  let pdfKey: string | null = null;
  let xlsxKey: string | null = null;
  try {
    const { unit } = await getSettings();
    const [pdf, xlsx] = await Promise.all([summaryToPdf(figures, unit), summaryToXlsx(figures, unit)]);
    pdfKey = `${base}.pdf`;
    xlsxKey = `${base}.xlsx`;
    await putObject(pdfKey, pdf, 'application/pdf');
    await putObject(xlsxKey, xlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (err) {
    // Storage problems must not lose the figures; exports can be regenerated on demand.
    console.error('summary export failed', err);
    pdfKey = null;
    xlsxKey = null;
  }

  const report = await db.summaryReport.upsert({
    where: { period_periodStart: { period, periodStart: dateOnly(start) } },
    create: { period, periodStart: dateOnly(start), periodEnd: dateOnly(end), figures: figures as object, pdfKey, xlsxKey },
    update: { periodEnd: dateOnly(end), figures: figures as object, pdfKey, xlsxKey, generatedAt: new Date() },
  });

  if (opts.announce !== false) {
    const recipients = await usersWithAppointments(['COMMANDER', 'CO_FLYING_WING']);
    const label = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly' }[period];
    await notify(recipients, { kind: 'summary.ready', title: `${label} summary ready (${start === end ? start : `${start} to ${end}`})`, link: `/reports/${report.id}`, email: true });
  }
  return report;
}
