// ============================================================
// buildFiscalYears — unit tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { buildFiscalYears } from '../buildFiscalYears';

describe('buildFiscalYears', () => {
  it('fallback : exercice calendaire 12 mois quand firstFiscalYearEndDate est null', () => {
    const years = buildFiscalYears({
      bpStartDate: new Date('2025-01-01'),
      bpYears: 3,
      fiscalYearStartMonth: 1,
      fiscalYearStartDay: 1,
      firstFiscalYearEndDate: null,
    });
    expect(years).toHaveLength(3);
    expect(years[0].monthCount).toBe(12);
    expect(years[1].monthCount).toBe(12);
    expect(years[2].monthCount).toBe(12);
    expect(years[0].isLongFirstYear).toBe(false);
  });

  it('premier exercice long : Sept 2025 → Déc 2026 (16 mois) puis Y2/Y3 calendaires', () => {
    const years = buildFiscalYears({
      bpStartDate: new Date('2025-09-01'),
      bpYears: 3,
      fiscalYearStartMonth: 1,
      fiscalYearStartDay: 1,
      firstFiscalYearEndDate: new Date('2026-12-31'),
    });
    expect(years).toHaveLength(3);
    expect(years[0].monthCount).toBe(16);
    expect(years[0].isLongFirstYear).toBe(true);
    expect(years[0].label).toMatch(/^Année 1 \(.*16 mois\)$/);
    expect(years[0].start.toISOString().slice(0, 10)).toBe('2025-09-01');
    expect(years[0].end.toISOString().slice(0, 10)).toBe('2026-12-31');

    expect(years[1].monthCount).toBe(12);
    expect(years[1].start.toISOString().slice(0, 10)).toBe('2027-01-01');
    expect(years[1].end.toISOString().slice(0, 10)).toBe('2027-12-31');

    expect(years[2].monthCount).toBe(12);
    expect(years[2].start.toISOString().slice(0, 10)).toBe('2028-01-01');
    expect(years[2].end.toISOString().slice(0, 10)).toBe('2028-12-31');
  });

  it('premier exercice court : 4 mois (création tardive)', () => {
    const years = buildFiscalYears({
      bpStartDate: new Date('2025-09-01'),
      bpYears: 3,
      fiscalYearStartMonth: 1,
      fiscalYearStartDay: 1,
      firstFiscalYearEndDate: new Date('2025-12-31'),
    });
    expect(years[0].monthCount).toBe(4);
    expect(years[0].isLongFirstYear).toBe(false);
    expect(years[1].monthCount).toBe(12);
  });

  it('premier exercice = 12 mois exact (pas de badge long)', () => {
    const years = buildFiscalYears({
      bpStartDate: new Date('2025-04-01'),
      bpYears: 2,
      fiscalYearStartMonth: 1,
      fiscalYearStartDay: 1,
      firstFiscalYearEndDate: new Date('2026-03-31'),
    });
    expect(years[0].monthCount).toBe(12);
    expect(years[0].isLongFirstYear).toBe(false);
  });

  it('mois consécutifs sans trou ni recouvrement entre Y1 et Y2', () => {
    const years = buildFiscalYears({
      bpStartDate: new Date('2025-09-01'),
      bpYears: 3,
      fiscalYearStartMonth: 1,
      fiscalYearStartDay: 1,
      firstFiscalYearEndDate: new Date('2026-12-31'),
    });
    const lastY1 = years[0].months[years[0].months.length - 1];
    const firstY2 = years[1].months[0];
    expect(lastY1.toISOString().slice(0, 7)).toBe('2026-12');
    expect(firstY2.toISOString().slice(0, 7)).toBe('2027-01');
  });
});
