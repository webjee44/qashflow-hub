import { describe, it, expect } from 'vitest';
import {
  monthKey,
  firstOfMonthParis,
  buildMonthRange,
  dayKeyParis,
  isSameOrBeforeDay,
  isBeforeDay,
  isAfterDay,
  normalizeAmount,
  isInternalTransfer,
} from '../index';

describe('monthKey', () => {
  it('returns YYYY-MM in Europe/Paris', () => {
    expect(monthKey('2026-04-15')).toBe('2026-04');
    expect(monthKey(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01'); // Paris is +01 in winter
  });
  it('throws on invalid', () => {
    expect(() => monthKey('not a date')).toThrow();
  });
});

describe('firstOfMonthParis', () => {
  it('anchors on first of month', () => {
    expect(monthKey(firstOfMonthParis('2026-04-15'))).toBe('2026-04');
  });
});

describe('buildMonthRange', () => {
  it('builds inclusive range', () => {
    const range = buildMonthRange('2026-01-15', '2026-04-10');
    expect(range.map(monthKey)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
  });
  it('handles single month', () => {
    expect(buildMonthRange('2026-05-01', '2026-05-31').map(monthKey)).toEqual(['2026-05']);
  });
  it('returns empty when reversed', () => {
    expect(buildMonthRange('2026-06-01', '2026-01-01')).toEqual([]);
  });
});

describe('day comparisons (Paris)', () => {
  it('dayKeyParis formats YYYY-MM-DD', () => {
    expect(dayKeyParis('2026-04-15T10:00:00Z')).toBe('2026-04-15');
  });
  it('isSameOrBeforeDay', () => {
    expect(isSameOrBeforeDay('2026-04-14', '2026-04-15')).toBe(true);
    expect(isSameOrBeforeDay('2026-04-15', '2026-04-15')).toBe(true);
    expect(isSameOrBeforeDay('2026-04-16', '2026-04-15')).toBe(false);
  });
  it('isBeforeDay strict', () => {
    expect(isBeforeDay('2026-04-15', '2026-04-15')).toBe(false);
    expect(isBeforeDay('2026-04-14', '2026-04-15')).toBe(true);
  });
  it('isAfterDay strict', () => {
    expect(isAfterDay('2026-04-16', '2026-04-15')).toBe(true);
    expect(isAfterDay('2026-04-15', '2026-04-15')).toBe(false);
  });
});

describe('normalizeAmount', () => {
  it('returns abs', () => {
    expect(normalizeAmount(-12.5)).toBe(12.5);
    expect(normalizeAmount('42')).toBe(42);
    expect(normalizeAmount(null)).toBe(0);
    expect(normalizeAmount('')).toBe(0);
    expect(normalizeAmount('not a number')).toBe(0);
  });
});

describe('isInternalTransfer', () => {
  it('matches the system category name exactly', () => {
    expect(isInternalTransfer({ categoryName: 'Virement intercompte' })).toBe(true);
    expect(isInternalTransfer({ categoryName: 'Autre' })).toBe(false);
    expect(isInternalTransfer({ categoryName: null })).toBe(false);
    expect(isInternalTransfer({})).toBe(false);
  });
});
