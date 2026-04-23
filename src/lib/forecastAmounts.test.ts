import {
  calculatePercentOfRevenueForecast,
  getVatFromAmount,
  normalizeForecastAmountBasis,
  toHt,
  toTtc,
} from './forecastAmounts';

describe('forecastAmounts', () => {
  it('normalizes unknown amount bases to ttc', () => {
    expect(normalizeForecastAmountBasis(undefined)).toBe('ttc');
    expect(normalizeForecastAmountBasis('other')).toBe('ttc');
  });

  it('converts legacy HT forecasts to TTC for display', () => {
    expect(toTtc(190000, 'ht', 0.2)).toBe(228000);
  });

  it('converts TTC forecasts back to HT for percentage calculations', () => {
    expect(toHt(190000, 'ttc', 0.2)).toBeCloseTo(158333.333333, 6);
  });

  it('extracts VAT correctly from TTC amounts', () => {
    expect(getVatFromAmount(95000, 'ttc', 0.2)).toBeCloseTo(15833.333333, 6);
  });

  it('calculates percent_of_revenue from CA HT and returns TTC for display', () => {
    expect(
      calculatePercentOfRevenueForecast({
        percentage: 50,
        revenueHt: 79166.666667,
        vatRate: 0.2,
        outputBasis: 'ttc',
      }),
    ).toBeCloseTo(47500, 6);
  });

  it('keeps the Cloud Vapor rule mathematically correct: 50% of CA HT then displayed TTC', () => {
    const revenueDisplayedTtc = 190000;
    const revenueHt = toHt(revenueDisplayedTtc, 'ttc', 0.2);

    const adnsDisplayedTtc = calculatePercentOfRevenueForecast({
      percentage: 50,
      revenueHt,
      vatRate: 0.2,
      outputBasis: 'ttc',
    });

    expect(revenueHt).toBeCloseTo(158333.333333, 6);
    expect(adnsDisplayedTtc).toBeCloseTo(95000, 6);
  });
});