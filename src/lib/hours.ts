// Aircraft and flight hours are entered and shown as HH:MM (hours:minutes), the way they appear in
// logbooks. They are stored as decimal hours to 2 places, which round-trips whole minutes exactly.

/** 1234.5 → "1234:30". Negative values (overdue) show with a minus sign. */
export function formatHours(value: number | string | { toString(): string } | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(typeof value === 'object' ? value.toString() : value);
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const total = Math.round(Math.abs(n) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

/** Minutes → "1:25". */
export function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return '—';
  return formatHours(min / 60);
}

/**
 * Accepts "1234:30", "1234", "0:45" or ":45". Returns decimal hours, or null if the text is not a
 * valid HH:MM value (minutes must be 00–59).
 */
export function parseHours(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m = /^(\d{0,6})(?::([0-5]?\d))?$/.exec(t);
  if (!m || (m[1] === '' && m[2] === undefined)) return null;
  const h = Number(m[1] || 0);
  const min = Number(m[2] ?? 0);
  return Math.round((h + min / 60) * 100) / 100;
}

export const HOURS_PATTERN = '^\\d{0,6}(:[0-5]?\\d)?$';
