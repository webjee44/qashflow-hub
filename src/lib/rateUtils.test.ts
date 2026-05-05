import { describe, it, expect } from 'vitest';
import { normalizeRate } from './rateUtils';

describe('normalizeRate', () => {
  it('returns decimal as-is when <= 1', () => {
    expect(normalizeRate(0.45)).toBe(0.45);
    expect(normalizeRate(0)).toBe(0);
    expect(normalizeRate(1)).toBe(1);
  });

  it('divides by 100 when > 1 (percentage form)', () => {
    expect(normalizeRate(45)).toBe(0.45);
    expect(normalizeRate(100)).toBe(1);
    expect(normalizeRate(4500)).toBe(45);
  });

  it('falls back on non-finite values', () => {
    expect(normalizeRate(null)).toBe(0);
    expect(normalizeRate(undefined)).toBe(0);
    expect(normalizeRate(NaN)).toBe(0);
    expect(normalizeRate('foo')).toBe(0);
    expect(normalizeRate(null, 0.5)).toBe(0.5);
  });

  it('clamps negative to 0', () => {
    expect(normalizeRate(-0.1)).toBe(0);
  });

  it('parses string numbers', () => {
    expect(normalizeRate('0.45')).toBe(0.45);
    expect(normalizeRate('45')).toBe(0.45);
  });
});
