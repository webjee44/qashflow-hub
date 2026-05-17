/**
 * Project convention: amounts are stored as absolute positive numbers.
 * The sign is derived from the row's `type` (income | expense).
 */
export function normalizeAmount(raw: number | string | null | undefined): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n);
}
