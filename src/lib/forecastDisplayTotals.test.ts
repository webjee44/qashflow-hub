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
  });
});