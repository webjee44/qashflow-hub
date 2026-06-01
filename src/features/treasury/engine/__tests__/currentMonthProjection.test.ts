import { describe, it, expect } from 'vitest';
import {
  computeCurrentMonthProjection,
  linesToBucketAmounts,
  bucketAmountsToLines,
} from '../currentMonthProjection';

describe('computeCurrentMonthProjection — single source of truth', () => {
  it('all empty → empty projection', () => {
    const r = computeCurrentMonthProjection({
      actualByBucket: {},
      forecastByBucket: {},
    });
    expect(r.projectedByBucket).toEqual({});
    expect(r.remainingByBucket).toEqual({});
  });

  it('forecast only (1er du mois, no actuals) → projection = forecast', () => {
    const r = computeCurrentMonthProjection({
      actualByBucket: {},
      forecastByBucket: { revenue: 250_000, fixed_expenses: -200_000 },
    });
    expect(r.projectedByBucket).toEqual({
      revenue: 250_000,
      fixed_expenses: -200_000,
    });
    expect(r.remainingByBucket).toEqual({
      revenue: 250_000,
      fixed_expenses: -200_000,
    });
  });

  it('actuals < forecast (per bucket) → projection = forecast', () => {
    const r = computeCurrentMonthProjection({
      actualByBucket: { revenue: 80_000, fixed_expenses: -50_000 },
      forecastByBucket: { revenue: 250_000, fixed_expenses: -200_000 },
    });
    expect(r.projectedByBucket.revenue).toBe(250_000);
    expect(r.projectedByBucket.fixed_expenses).toBe(-200_000);
  });

  it('actuals > forecast (per bucket) → projection = actuals', () => {
    const r = computeCurrentMonthProjection({
      actualByBucket: { revenue: 310_000, fixed_expenses: -240_000 },
      forecastByBucket: { revenue: 250_000, fixed_expenses: -200_000 },
    });
    expect(r.projectedByBucket.revenue).toBe(310_000);
    expect(r.projectedByBucket.fixed_expenses).toBe(-240_000);
    expect(r.remainingByBucket).toEqual({}); // nothing left in the envelope
  });

  it('mixed buckets — rule applied independently per bucket', () => {
    const r = computeCurrentMonthProjection({
      actualByBucket: {
        revenue: 310_000,         // exceeds forecast
        personnel: -10_000,       // under-consumed
        fixed_expenses: -200_000, // matches exactly
      },
      forecastByBucket: {
        revenue: 250_000,
        personnel: -50_000,
        fixed_expenses: -200_000,
      },
    });
    expect(r.projectedByBucket.revenue).toBe(310_000);
    expect(r.projectedByBucket.personnel).toBe(-50_000);
    expect(r.projectedByBucket.fixed_expenses).toBe(-200_000);
  });

  it('preserves outflow sign even when no actual', () => {
    const r = computeCurrentMonthProjection({
      actualByBucket: {},
      forecastByBucket: { payroll_taxes: -15_000, vat_payments: -8_000 },
    });
    expect(r.projectedByBucket.payroll_taxes).toBe(-15_000);
    expect(r.projectedByBucket.vat_payments).toBe(-8_000);
  });

  it('forecast missing for a bucket but actual present → projection = actual', () => {
    const r = computeCurrentMonthProjection({
      actualByBucket: { other_inflow: 5_000 },
      forecastByBucket: {},
    });
    expect(r.projectedByBucket.other_inflow).toBe(5_000);
  });
});

describe('adapters', () => {
  it('linesToBucketAmounts aggregates duplicate buckets', () => {
    const out = linesToBucketAmounts([
      { bucket: 'revenue', amount: 100, transactionIds: [] },
      { bucket: 'revenue', amount: 50, transactionIds: [] },
      { bucket: 'personnel', amount: -30, transactionIds: [] },
    ]);
    expect(out).toEqual({ revenue: 150, personnel: -30 });
  });

  it('bucketAmountsToLines drops zero entries and preserves sign', () => {
    const lines = bucketAmountsToLines({
      revenue: 200,
      personnel: -40,
      fixed_expenses: 0,
    });
    expect(lines).toEqual([
      { bucket: 'revenue', amount: 200, transactionIds: [] },
      { bucket: 'personnel', amount: -40, transactionIds: [] },
    ]);
  });
});
