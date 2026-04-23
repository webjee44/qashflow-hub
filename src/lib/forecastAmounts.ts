export type ForecastAmountBasis = 'ht' | 'ttc';

const normalizeAmount = (amount: number) => Number.isFinite(amount) ? amount : 0;

const normalizeVatRate = (vatRate: number | null | undefined) =>
  Number.isFinite(vatRate) ? Math.max(vatRate ?? 0, 0) : 0;

export const normalizeForecastAmountBasis = (
  basis: string | null | undefined,
): ForecastAmountBasis => (basis === 'ht' ? 'ht' : 'ttc');

export const toTtc = (
  amount: number,
  basis: string | null | undefined,
  vatRate: number | null | undefined,
): number => {
  const normalizedAmount = normalizeAmount(amount);
  const normalizedVatRate = normalizeVatRate(vatRate);

  return normalizeForecastAmountBasis(basis) === 'ht'
    ? normalizedAmount * (1 + normalizedVatRate)
    : normalizedAmount;
};

export const toHt = (
  amount: number,
  basis: string | null | undefined,
  vatRate: number | null | undefined,
): number => {
  const normalizedAmount = normalizeAmount(amount);
  const normalizedVatRate = normalizeVatRate(vatRate);

  if (normalizeForecastAmountBasis(basis) === 'ht' || normalizedVatRate === 0) {
    return normalizedAmount;
  }

  return normalizedAmount / (1 + normalizedVatRate);
};

export const getVatFromAmount = (
  amount: number,
  basis: string | null | undefined,
  vatRate: number | null | undefined,
): number => {
  const normalizedAmount = normalizeAmount(amount);
  const normalizedVatRate = normalizeVatRate(vatRate);

  if (normalizedVatRate === 0) {
    return 0;
  }

  return normalizeForecastAmountBasis(basis) === 'ht'
    ? normalizedAmount * normalizedVatRate
    : normalizedAmount * normalizedVatRate / (1 + normalizedVatRate);
};

export const calculatePercentOfRevenueForecast = ({
  percentage,
  revenueHt,
  vatRate,
  outputBasis = 'ttc',
}: {
  percentage: number;
  revenueHt: number;
  vatRate: number | null | undefined;
  outputBasis?: ForecastAmountBasis;
}): number => {
  const baseHtAmount = normalizeAmount(revenueHt) * (normalizeAmount(percentage) / 100);

  return outputBasis === 'ht'
    ? baseHtAmount
    : toTtc(baseHtAmount, 'ht', vatRate);
};