import { db } from '../../lib/db';
import { generateSummary } from '../../lib/reports/generate';
import { periodRange } from '../../lib/reports/summary';
import { getSettings } from '../../lib/settings';
import { addDays, dateOnly, localDate, localTime } from '../../lib/time';
import type { SummaryPeriod } from '@prisma/client';

async function exists(period: SummaryPeriod, anchor: string) {
  const { start } = periodRange(period, anchor);
  const r = await db.summaryReport.findUnique({ where: { period_periodStart: { period, periodStart: dateOnly(start) } }, select: { id: true } });
  return !!r;
}

/**
 * Runs every five minutes and generates any summary that is due but missing:
 * daily after the configured time; weekly on the configured day after that time (Monday–Sunday week);
 * monthly and quarterly from 06:00 on the first day, covering the period just ended.
 */
export async function summariesDue(now: Date = new Date()) {
  const s = await getSettings();
  const today = localDate(now);
  const time = localTime(now);
  const yesterday = addDays(today, -1);

  if (time >= s.summarySchedule.dailyTime && !(await exists('DAILY', today))) {
    await generateSummary('DAILY', today);
  }
  const dow = dateOnly(today).getUTCDay();
  if (dow === s.summarySchedule.weeklyDay && time >= s.summarySchedule.dailyTime && !(await exists('WEEKLY', today))) {
    await generateSummary('WEEKLY', today);
  }
  if (today.endsWith('-01') && time >= '06:00') {
    if (!(await exists('MONTHLY', yesterday))) await generateSummary('MONTHLY', yesterday);
    const month = Number(today.slice(5, 7));
    if ([1, 4, 7, 10].includes(month) && !(await exists('QUARTERLY', yesterday))) await generateSummary('QUARTERLY', yesterday);
  }
}
