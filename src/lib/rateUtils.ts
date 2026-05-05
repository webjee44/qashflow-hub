/**
 * Normalize a rate value to a decimal fraction.
 *
 * Accepts both decimal (0.45) and percentage (45) formats and returns a
 * decimal in [0, +inf). Any value > 1 is assumed to be a percentage and
 * divided by 100. Non-finite or null values fall back to `fallback`.
 *
 * Used as a defensive guardrail across BP calculations so that a single
 * data-entry mistake (45 vs 0.45) cannot blow the P&L by a factor of 100.
 */
export const normalizeRate = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  return n > 1 ? n / 100 : n;
};
