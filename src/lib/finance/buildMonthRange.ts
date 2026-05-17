import { firstOfMonthParis, monthKey } from './monthKey';

/**
 * Inclusive list of first-of-month dates from `from` up to and including `to`,
 * anchored on Europe/Paris calendar months.
 */
export function buildMonthRange(from: Date | string, to: Date | string): Date[] {
  const start = firstOfMonthParis(from);
  const end = firstOfMonthParis(to);
  if (end.getTime() < start.getTime()) return [];

  const months: Date[] = [];
  let cursor = start;
  // Safety guard: cap at 600 months (50 years).
  for (let i = 0; i < 600; i++) {
    months.push(cursor);
    if (monthKey(cursor) === monthKey(end)) break;
    // Advance to next month using UTC arithmetic on the anchor.
    cursor = new Date(Date.UTC(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      1,
      12, 0, 0,
    ));
  }
  return months;
}
