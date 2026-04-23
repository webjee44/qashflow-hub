import { getDisplayedNetVariation, getDisplayedSectionTotals } from './forecastDisplayTotals';

describe('forecast display totals (TTC convention)', () => {
  it('includes uncategorized actuals in displayed section totals', () => {
    expect(
      getDisplayedSectionTotals({
        type: 'income',
        categorizedActual: 3000,
        uncategorizedActual: 425,
        categorizedForecast: 296472,
        netVatForecast: 9999, // ignored under TTC convention
      }),
    ).toEqual({ actual: 3425, forecast: 296472 });
  });

  it('does NOT add net VAT to displayed expense forecast (TTC already includes VAT)', () => {
    expect(
      getDisplayedSectionTotals({
        type: 'expense',
        categorizedActual: 9000,
        uncategorizedActual: 593,
        categorizedForecast: 260000,
        netVatForecast: 6400, // ignored under TTC convention
      }),
    ).toEqual({ actual: 9593, forecast: 260000 });
  });

  it('ignores VAT credits in displayed expense forecasts', () => {
    expect(
      getDisplayedSectionTotals({
        type: 'expense',
        categorizedActual: 1000,
        uncategorizedActual: 0,
        categorizedForecast: 12000,
        netVatForecast: -850,
      }),
    ).toEqual({ actual: 1000, forecast: 12000 });
  });

  it('keeps net variation aligned with displayed section totals', () => {
    const incomeTotals = getDisplayedSectionTotals({
      type: 'income',
      categorizedActual: 3000,
      uncategorizedActual: 425,
      categorizedForecast: 296472,
    });

    const expenseTotals = getDisplayedSectionTotals({
      type: 'expense',
      categorizedActual: 9000,
      uncategorizedActual: 593,
      categorizedForecast: 260000,
    });

    expect(getDisplayedNetVariation(incomeTotals, expenseTotals)).toEqual({
      actual: -6168,
      forecast: 36472,
    });
  });

  it('guarantees opening + net = closing (Cloud Vapor regression, TTC)', () => {
    // Cloud Vapor case: opening = 14332, income TTC forecast = 296472, expense TTC = 260000
    // Net forecast = 36472 (no VAT double-count)
    // Expected closing = 14332 + 36472 = 50804
    const opening = 14332;

    const incomeTotals = getDisplayedSectionTotals({
      type: 'income',
      categorizedActual: 0,
      uncategorizedActual: 0,
      categorizedForecast: 296472,
    });

    const expenseTotals = getDisplayedSectionTotals({
      type: 'expense',
      categorizedActual: 0,
      uncategorizedActual: 0,
      categorizedForecast: 260000,
    });

    const net = getDisplayedNetVariation(incomeTotals, expenseTotals);
    const closing = opening + net.forecast;

    expect(net.forecast).toBe(36472);
    expect(closing).toBe(50804);
  });

  it('ensures inter-month continuity: closing(M) = opening(M+1)', () => {
    const initialOpening = 10000;
    const monthNets = [5000, -3000, 8000];

    let opening = initialOpening;
    for (const net of monthNets) {
      const closing = opening + net;
      opening = closing;
    }

    expect(opening).toBe(20000);
  });
});
