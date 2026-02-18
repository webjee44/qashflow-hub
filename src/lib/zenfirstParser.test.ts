import { describe, it, expect } from 'vitest';
import {
  parseZenfirstMonth,
  parseZenfirstAmount,
  parseZenfirstCSV,
  getLeafItems,
  getGroupItems,
  generateColor,
} from './zenfirstParser';

// ── parseZenfirstMonth ──────────────────────────────────────────

describe('parseZenfirstMonth', () => {
  it('parses "Janvier 2026"', () => {
    expect(parseZenfirstMonth('Janvier 2026')).toBe('2026-01-01');
  });

  it('parses accented "février 2025"', () => {
    expect(parseZenfirstMonth('février 2025')).toBe('2025-02-01');
  });

  it('parses unaccented "fevrier 2025"', () => {
    expect(parseZenfirstMonth('fevrier 2025')).toBe('2025-02-01');
  });

  it('parses "Décembre 2024"', () => {
    expect(parseZenfirstMonth('Décembre 2024')).toBe('2024-12-01');
  });

  it('returns null for single word', () => {
    expect(parseZenfirstMonth('invalid')).toBeNull();
  });

  it('returns null for unknown month name', () => {
    expect(parseZenfirstMonth('Foo 2026')).toBeNull();
  });

  it('returns null for invalid year', () => {
    expect(parseZenfirstMonth('Janvier 20')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseZenfirstMonth('')).toBeNull();
  });
});

// ── parseZenfirstAmount ─────────────────────────────────────────

describe('parseZenfirstAmount', () => {
  it('parses "30 647" (French thousands separator)', () => {
    expect(parseZenfirstAmount('30 647')).toBe(30647);
  });

  it('parses negative "-24 802"', () => {
    expect(parseZenfirstAmount('-24 802')).toBe(-24802);
  });

  it('handles comma decimal "1 705,50"', () => {
    expect(parseZenfirstAmount('1 705,50')).toBe(1705.5);
  });

  it('returns 0 for empty string', () => {
    expect(parseZenfirstAmount('')).toBe(0);
  });

  it('returns 0 for whitespace-only', () => {
    expect(parseZenfirstAmount('   ')).toBe(0);
  });

  it('parses simple integer "42"', () => {
    expect(parseZenfirstAmount('42')).toBe(42);
  });

  it('returns 0 for non-numeric text', () => {
    expect(parseZenfirstAmount('abc')).toBe(0);
  });
});

// ── parseZenfirstCSV ────────────────────────────────────────────

const SAMPLE_CSV = `Entreprise: Ma Société
Plan de trésorerie du 01/01/2026 au 31/03/2026
Scénario;Janvier 2026;Février 2026;Mars 2026;Total
En début de mois;100 000;110 000;120 000;120 000
Encaissements
        Ventes;10 000;12 000;14 000;36 000
        Services;5 000;6 000;7 000;18 000
Décaissements
        Loyer;-2 000;-2 000;-2 000;-6 000
        Salaires;-8 000;-8 500;-9 000;-25 500
En fin de mois;105 000;117 500;130 500;130 500`;

describe('parseZenfirstCSV', () => {
  it('extracts company name', () => {
    const result = parseZenfirstCSV(SAMPLE_CSV);
    expect(result.companyName).toBe('Ma Société');
  });

  it('extracts date range', () => {
    const result = parseZenfirstCSV(SAMPLE_CSV);
    expect(result.startDate).toBe('2026-01-01');
    expect(result.endDate).toBe('2026-03-31');
  });

  it('extracts 3 months', () => {
    const result = parseZenfirstCSV(SAMPLE_CSV);
    expect(result.months).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('extracts income items', () => {
    const result = parseZenfirstCSV(SAMPLE_CSV);
    const incomes = result.items.filter(i => i.type === 'income');
    expect(incomes.length).toBe(2);
    expect(incomes.map(i => i.name)).toContain('Ventes');
    expect(incomes.map(i => i.name)).toContain('Services');
  });

  it('extracts expense items', () => {
    const result = parseZenfirstCSV(SAMPLE_CSV);
    const expenses = result.items.filter(i => i.type === 'expense');
    expect(expenses.length).toBe(2);
    expect(expenses.map(i => i.name)).toContain('Loyer');
  });

  it('stores absolute monthly amounts for expenses', () => {
    const result = parseZenfirstCSV(SAMPLE_CSV);
    const loyer = result.items.find(i => i.name === 'Loyer');
    expect(loyer?.monthlyAmounts['2026-01-01']).toBe(2000);
  });

  it('returns errors for too-short content', () => {
    const result = parseZenfirstCSV('short');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ── getLeafItems / getGroupItems ────────────────────────────────

describe('getLeafItems & getGroupItems', () => {
  const items = [
    { name: 'A', isGroup: true },
    { name: 'B', isGroup: false },
    { name: 'C', isGroup: false },
  ] as any;

  it('getLeafItems returns only non-group items', () => {
    expect(getLeafItems(items).map(i => i.name)).toEqual(['B', 'C']);
  });

  it('getGroupItems returns only group items', () => {
    expect(getGroupItems(items).map(i => i.name)).toEqual(['A']);
  });
});

// ── generateColor ───────────────────────────────────────────────

describe('generateColor', () => {
  it('returns an hsl string for income', () => {
    expect(generateColor(0, 'income')).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });

  it('returns an hsl string for expense', () => {
    expect(generateColor(2, 'expense')).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/);
  });
});
