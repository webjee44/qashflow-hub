/**
 * Day-granularity comparisons in Europe/Paris timezone.
 * Returns YYYY-MM-DD for the Paris-local calendar date of `d`.
 */
const PARIS_TZ = 'Europe/Paris';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function dayKeyParis(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`dayKeyParis: invalid date ${String(d)}`);
  }
  return dayFormatter.format(date);
}

export function isSameOrBeforeDay(a: Date | string, b: Date | string): boolean {
  return dayKeyParis(a) <= dayKeyParis(b);
}

export function isBeforeDay(a: Date | string, b: Date | string): boolean {
  return dayKeyParis(a) < dayKeyParis(b);
}

export function isAfterDay(a: Date | string, b: Date | string): boolean {
  return dayKeyParis(a) > dayKeyParis(b);
}
