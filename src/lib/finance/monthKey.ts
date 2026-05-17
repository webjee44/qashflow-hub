/**
 * Returns YYYY-MM key for a date, normalized to Europe/Paris timezone.
 * Pure function — no external state.
 */
const PARIS_TZ = 'Europe/Paris';

const monthKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TZ,
  year: 'numeric',
  month: '2-digit',
});

export function monthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    throw new Error(`monthKey: invalid date ${String(date)}`);
  }
  // en-CA gives YYYY-MM-DD, slice to YYYY-MM
  return monthKeyFormatter.format(d).slice(0, 7);
}

/**
 * First day of the month containing `date`, expressed as a UTC Date whose
 * Europe/Paris calendar date is YYYY-MM-01 at 00:00.
 */
export function firstOfMonthParis(date: Date | string): Date {
  const key = monthKey(date);
  // Europe/Paris is UTC+1 or UTC+2. We anchor at noon UTC to avoid DST flips
  // when later re-displayed; consumers should rely on monthKey() for equality.
  return new Date(`${key}-01T12:00:00Z`);
}
