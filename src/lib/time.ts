// Time helpers. The unit works in West Africa Time (Africa/Lagos, UTC+1, no daylight saving).
// Everything is stored in UTC; screens show local time with Zulu alongside.

export const TZ = 'Africa/Lagos';
const OFFSET_MIN = 60; // WAT is a fixed UTC+1

/** "2026-10-16" + "07:30" (local) → Date (UTC instant) */
export function localToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - OFFSET_MIN * 60_000);
}

/** The local calendar date (YYYY-MM-DD) of an instant */
export function localDate(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Local HH:mm of an instant */
export function localTime(at: Date): string {
  const shifted = new Date(at.getTime() + OFFSET_MIN * 60_000);
  return shifted.toISOString().slice(11, 16);
}

/** Zulu HH:mmZ of an instant */
export function zuluTime(at: Date): string {
  return `${at.toISOString().slice(11, 16)}Z`;
}

/** UTC instants bounding a local calendar day */
export function localDayBounds(date: string): { start: Date; end: Date } {
  const start = localToUtc(date, '00:00');
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** A local date string as a Date at UTC midnight, for @db.Date columns */
export function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function dateOnlyToString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = dateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return dateOnlyToString(d);
}

export function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateOnly(date));
}

export function formatShortDate(at: Date | string): string {
  const d = typeof at === 'string' ? dateOnly(at) : at;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(d);
}

export function formatDateTime(at: Date): string {
  return `${formatShortDate(at)} ${localTime(at)} (${zuluTime(at)})`;
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60_000);
}

/** "1:40" from minutes */
export function hm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.abs(minutes % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** "T-52 min" style countdown to take-off */
export function countdown(takeoff: Date, now: Date = new Date()): string {
  const mins = minutesBetween(now, takeoff);
  if (mins >= 0) return `T-${mins} min`;
  return `T+${-mins} min`;
}

/** Start of the ISO week (Monday) for a local date */
export function weekStart(date: string): string {
  const d = dateOnly(date);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -dow);
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function quarterStart(date: string): string {
  const m = Number(date.slice(5, 7));
  const qm = Math.floor((m - 1) / 3) * 3 + 1;
  return `${date.slice(0, 4)}-${String(qm).padStart(2, '0')}-01`;
}

export function addMonths(date: string, months: number): string {
  const d = dateOnly(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return dateOnlyToString(d);
}
