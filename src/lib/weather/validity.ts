// How long a weather report can be used. A METAR is valid for 1 hour from its observation time.
// A TAF is valid for its stated period (at most 30 hours); without one, 30 hours from issue.

export const METAR_VALID_MINUTES = 60;
export const TAF_MAX_HOURS = 30;

type ReportTimes = {
  kind: string;
  observedAt: Date | string | null;
  validFrom?: Date | string | null;
  validTo: Date | string | null;
  createdAt: Date | string;
};

const t = (d: Date | string) => new Date(d).getTime();

export function expiresAt(r: ReportTimes): Date {
  if (r.kind === 'METAR') return new Date(t(r.observedAt ?? r.createdAt) + METAR_VALID_MINUTES * 60_000);
  if (r.validTo) return new Date(t(r.validTo));
  return new Date(t(r.observedAt ?? r.createdAt) + TAF_MAX_HOURS * 3_600_000);
}

export function isExpired(r: ReportTimes, now: Date = new Date()): boolean {
  return expiresAt(r).getTime() <= now.getTime();
}

/** Problems that stop a report being published at all (already out of date, or impossible times). */
export function entryProblem(
  r: { kind: 'METAR' | 'TAF'; observedAt: Date | null; validFrom: Date | null; validTo: Date | null },
  now: Date = new Date(),
): string | null {
  const hhmm = (d: Date) => `${d.toISOString().slice(11, 16)}Z`;
  if (r.kind === 'METAR') {
    if (!r.observedAt) return 'The METAR needs its observation time, for example 191400Z.';
    if (r.observedAt.getTime() > now.getTime() + 10 * 60_000) return `The observation time ${hhmm(r.observedAt)} is in the future. Check the day and time.`;
    const exp = new Date(r.observedAt.getTime() + METAR_VALID_MINUTES * 60_000);
    if (exp <= now) return `This METAR was observed at ${hhmm(r.observedAt)} and expired at ${hhmm(exp)}. Enter the latest observation.`;
    return null;
  }
  if (!r.validFrom || !r.validTo) return 'The TAF needs its validity period, for example 1912/2018.';
  if (r.validTo.getTime() - r.validFrom.getTime() > TAF_MAX_HOURS * 3_600_000) return `A TAF can be valid for ${TAF_MAX_HOURS} hours at most. Check the validity period.`;
  if (r.validTo <= now) return `This TAF expired at ${hhmm(r.validTo)} on ${r.validTo.toISOString().slice(0, 10)}. Enter the current forecast.`;
  return null;
}
