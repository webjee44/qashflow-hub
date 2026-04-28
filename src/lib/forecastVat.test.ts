import { describe, it, expect } from 'vitest';
import {
  computeVatPayment,
  getVatRowDisplay,
  isSupportedVatRegime,
  normalizeVatRegime,
} from './forecastVat';

describe('forecastVat', () => {
  describe('normalizeVatRegime', () => {
    it('returns the value when supported', () => {
      expect(normalizeVatRegime('monthly_real')).toBe('monthly_real');
      expect(normalizeVatRegime('franchise')).toBe('franchise');
      expect(normalizeVatRegime('quarterly_real')).toBe('quarterly_real');
      expect(normalizeVatRegime('simplified')).toBe('simplified');
    });

    it('falls back to monthly_real for unknown / null values', () => {
      expect(normalizeVatRegime(null)).toBe('monthly_real');
      expect(normalizeVatRegime(undefined)).toBe('monthly_real');
      expect(normalizeVatRegime('foo' as never)).toBe('monthly_real');
    });

    it('isSupportedVatRegime guards correctly', () => {
      expect(isSupportedVatRegime('monthly_real')).toBe(true);
      expect(isSupportedVatRegime('garbage')).toBe(false);
      expect(isSupportedVatRegime(null)).toBe(false);
    });
  });

  describe('computeVatPayment — monthly_real', () => {
    it('owes the full net VAT when no carry exists', () => {
      const result = computeVatPayment({
        netVatPreviousMonth: 1234.56,
        regime: 'monthly_real',
      });
      expect(result).toEqual({ payment: 1234.56, carryOut: 0 });
    });

    it('reduces the payment with the incoming carry', () => {
      const result = computeVatPayment({
        netVatPreviousMonth: 1000,
        carryIn: 300,
        regime: 'monthly_real',
      });
      expect(result).toEqual({ payment: 700, carryOut: 0 });
    });

    it('produces no payment and accumulates the credit when net is negative', () => {
      const result = computeVatPayment({
        netVatPreviousMonth: -500,
        carryIn: 0,
        regime: 'monthly_real',
      });
      expect(result).toEqual({ payment: 0, carryOut: 500 });
    });

    it('combines incoming carry with new credit', () => {
      const result = computeVatPayment({
        netVatPreviousMonth: -200,
        carryIn: 150,
        regime: 'monthly_real',
      });
      // netDebt = -200 - 150 = -350 → payment 0, carryOut 350
      expect(result).toEqual({ payment: 0, carryOut: 350 });
    });

    it('carry > net consumed first, remainder carried forward', () => {
      const result = computeVatPayment({
        netVatPreviousMonth: 100,
        carryIn: 400,
        regime: 'monthly_real',
      });
      // netDebt = 100 - 400 = -300 → payment 0, carryOut 300
      expect(result).toEqual({ payment: 0, carryOut: 300 });
    });
  });

  describe('computeVatPayment — franchise', () => {
    it('always returns 0 regardless of inputs', () => {
      expect(
        computeVatPayment({
          netVatPreviousMonth: 9999,
          carryIn: 1000,
          regime: 'franchise',
        }),
      ).toEqual({ payment: 0, carryOut: 0 });
    });
  });

  describe('computeVatPayment — fallback regimes', () => {
    it('quarterly_real currently behaves like monthly_real', () => {
      expect(
        computeVatPayment({
          netVatPreviousMonth: 500,
          regime: 'quarterly_real',
        }),
      ).toEqual({ payment: 500, carryOut: 0 });
    });

    it('simplified currently behaves like monthly_real', () => {
      expect(
        computeVatPayment({
          netVatPreviousMonth: 500,
          regime: 'simplified',
        }),
      ).toEqual({ payment: 500, carryOut: 0 });
    });
  });

  describe('computeVatPayment — defensive', () => {
    it('treats non-finite inputs as zero', () => {
      expect(
        computeVatPayment({
          netVatPreviousMonth: Number.NaN,
          carryIn: Number.POSITIVE_INFINITY,
          regime: 'monthly_real',
        }),
      ).toEqual({ payment: 0, carryOut: 0 });
    });

    it('ignores negative carry (invalid input)', () => {
      expect(
        computeVatPayment({
          netVatPreviousMonth: 100,
          carryIn: -50,
          regime: 'monthly_real',
        }),
      ).toEqual({ payment: 100, carryOut: 0 });
    });
  });

  describe('getVatRowDisplay — actual écrase forecast', () => {
    it('past month with actual displays actual', () => {
      expect(
        getVatRowDisplay({
          periodType: 'past',
          actualPayment: 800,
          forecastPayment: 750,
        }),
      ).toEqual({ amount: 800, source: 'actual' });
    });

    it('past month without actual displays nothing (no retroactive forecast)', () => {
      expect(
        getVatRowDisplay({
          periodType: 'past',
          actualPayment: 0,
          forecastPayment: 750,
        }),
      ).toEqual({ amount: 0, source: 'none' });
    });

    it('current month: actual wins when present', () => {
      expect(
        getVatRowDisplay({
          periodType: 'current',
          actualPayment: 1200,
          forecastPayment: 1000,
        }),
      ).toEqual({ amount: 1200, source: 'actual' });
    });

    it('current month: forecast used when actual is zero', () => {
      expect(
        getVatRowDisplay({
          periodType: 'current',
          actualPayment: 0,
          forecastPayment: 1000,
        }),
      ).toEqual({ amount: 1000, source: 'forecast' });
    });

    it('future month: forecast displayed, actual ignored', () => {
      expect(
        getVatRowDisplay({
          periodType: 'future',
          actualPayment: 999,
          forecastPayment: 600,
        }),
      ).toEqual({ amount: 600, source: 'forecast' });
    });

    it('future month with no forecast: shows none', () => {
      expect(
        getVatRowDisplay({
          periodType: 'future',
          actualPayment: 0,
          forecastPayment: 0,
        }),
      ).toEqual({ amount: 0, source: 'none' });
    });
  });
});
