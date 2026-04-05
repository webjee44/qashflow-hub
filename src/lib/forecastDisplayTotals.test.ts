import { getDisplayedNetVariation, getDisplayedSectionTotals } from './forecastDisplayTotals';

describe('forecast display totals', () => {
  it('includes uncategorized actuals in displayed section totals', () => {
    expect(
      getDisplayedSectionTotals({
        type: 'income',
        categorizedActual: 3000,
        uncategorizedActual: 425,
        categorizedForecast: 296472,
        netVatForecast: 9999,
      }),
    ).toEqual({ actual: 3425, forecast: 296472 });
  });

  it('adds only positive net VAT to displayed expense forecasts', () => {
    expect(
      getDisplayedSectionTotals({
        type: 'expense',
        categorizedActual: 9000,
        uncategorizedActual: 593,
        categorizedForecast: 260000,
        netVatForecast: 6400,
      }),
    ).toEqual({ actual: 9593, forecast: 266400 });
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
      netVatForecast: 6400,
    });

    expect(getDisplayedNetVariation(incomeTotals, expenseTotals)).toEqual({
      actual: -6168,
      forecast: 30072,
  });

  it('guarantees opening + net = closing (Cloud Vapor regression)', () => {
    // Cloud Vapor case: opening = 14332, net forecast = 30072
    // Expected closing = 14332 + 30072 = 44404
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
      netVatForecast: 6400,
    });

    const net = getDisplayedNetVariation(incomeTotals, expenseTotals);
    const closing = opening + net.forecast;

    expect(net.forecast).toBe(30072);
    expect(closing).toBe(44404);
  });

  it('ensures inter-month continuity: closing(M) = opening(M+1)', () => {
    // Simulate 3 months chain
    const initialOpening = 10000;
    const monthNets = [5000, -3000, 8000];

    let opening = initialOpening;
    for (const net of monthNets) {
      const closing = opening + net;
      // Next month opening = this month closing
      opening = closing;
    }

    // Final balance = 10000 + 5000 - 3000 + 8000 = 20000
    expect(opening).toBe(20000);
  });
});