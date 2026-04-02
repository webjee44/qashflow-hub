export type ForecastDisplaySectionType = 'income' | 'expense';

export interface DisplayedSectionTotals {
  actual: number;
  forecast: number;
}

interface GetDisplayedSectionTotalsInput {
  type: ForecastDisplaySectionType;
  categorizedActual: number;
  uncategorizedActual?: number;
  categorizedForecast: number;
  netVatForecast?: number;
}

export const getDisplayedSectionTotals = ({
  type,
  categorizedActual,
  uncategorizedActual = 0,
  categorizedForecast,
  netVatForecast = 0,
}: GetDisplayedSectionTotalsInput): DisplayedSectionTotals => ({
  actual: categorizedActual + uncategorizedActual,
  forecast: categorizedForecast + (type === 'expense' ? Math.max(0, netVatForecast) : 0),
});

export const getDisplayedNetVariation = (
  incomeTotals: DisplayedSectionTotals,
  expenseTotals: DisplayedSectionTotals,
): DisplayedSectionTotals => ({
  actual: incomeTotals.actual - expenseTotals.actual,
  forecast: incomeTotals.forecast - expenseTotals.forecast,
});