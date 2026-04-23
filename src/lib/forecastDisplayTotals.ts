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
  /**
   * @deprecated Kept for backwards compatibility. Under the TTC convention
   * (see `features/treasury/cash-flow-standard`), VAT is already embedded in
   * each category's forecast amount, so `netVatForecast` is no longer added
   * to the displayed expense total to avoid double-counting.
   * The "TVA à décaisser" row remains as informational only.
   */
  netVatForecast?: number;
}

/**
 * Computes displayed section totals for the forecast table.
 *
 * Convention (TTC):
 *   - Stored `expected_amount` values are TTC (toutes taxes comprises).
 *   - The displayed forecast equals the sum of category forecasts.
 *   - Net VAT is shown on a separate informational row and is NOT added
 *     to encaissements/décaissements (it is already embedded in TTC).
 *
 * This guarantees the cash-flow invariant:
 *   opening + (income.forecast − expense.forecast) = closing
 */
export const getDisplayedSectionTotals = ({
  categorizedActual,
  uncategorizedActual = 0,
  categorizedForecast,
}: GetDisplayedSectionTotalsInput): DisplayedSectionTotals => ({
  actual: categorizedActual + uncategorizedActual,
  forecast: categorizedForecast,
});

export const getDisplayedNetVariation = (
  incomeTotals: DisplayedSectionTotals,
  expenseTotals: DisplayedSectionTotals,
): DisplayedSectionTotals => ({
  actual: incomeTotals.actual - expenseTotals.actual,
  forecast: incomeTotals.forecast - expenseTotals.forecast,
});
