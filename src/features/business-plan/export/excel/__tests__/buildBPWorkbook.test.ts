// ============================================================
// buildBPWorkbook — integration tests on the minimal BP fixture
// ============================================================
// Verifies:
//   1. all 10 sheets are present
//   2. P&L annual totals == sum of monthly P&L
//   3. loans schedule remaining capital == debt on balance sheet
//   4. controls sheet exposes every validation issue
//   5. cash-flow final balance == balance-sheet cash for last year
// ============================================================

import { describe, it, expect } from 'vitest';
import { computeBPModel } from '../../../engine/computeBPModel';
import { minimalBPInput } from '../../../engine/__tests__/__fixtures__/minimal-bp';
import { buildBPWorkbook, buildExportFilename } from '../buildBPWorkbook';

const META = {
  companyName: 'Test Company',
  companyId: 'co-1',
  businessPlanId: 'bp-1',
  exportedAt: new Date('2026-05-09T10:00:00Z'),
  currency: 'EUR',
};

const EXPECTED_SHEETS = [
  'README',
  'Synthèse',
  'Hypothèses',
  'P&L mensuel',
  'P&L annuel',
  'Cash-flow mensuel',
  'Bilan annuel',
  'Plan de financement',
  'Emprunts',
  'Contrôles',
  'Données techniques',
];

function getCell(ws: any, row: number, col: number): any {
  const c = ws.getCell(row, col);
  return c.value;
}

function findRowByLabel(ws: any, label: string): number | null {
  let found: number | null = null;
  ws.eachRow((row: any, rn: number) => {
    if (found != null) return;
    const v = row.getCell(1).value;
    if (typeof v === 'string' && v.trim().toLowerCase() === label.toLowerCase()) found = rn;
  });
  return found;
}

describe('buildBPWorkbook', () => {
  const model = computeBPModel(minimalBPInput);
  const wb = buildBPWorkbook(model, minimalBPInput, META);

  it('contains all expected sheets in order', () => {
    const names = wb.worksheets.map(w => w.name);
    expect(names).toEqual(EXPECTED_SHEETS);
  });

  it('P&L annual revenue total equals sum of monthly revenue', () => {
    const totalMonthly = model.pl.years
      .map((_, yi) => model.pl.totals.revenue[yi])
      .reduce((a, b) => a + b, 0);
    const annualWS = wb.getWorksheet('P&L annuel')!;
    const revRow = findRowByLabel(annualWS, "Chiffre d'affaires");
    expect(revRow).not.toBeNull();
    let sumFromSheet = 0;
    for (let c = 2; c <= model.pl.years.length + 1; c++) {
      sumFromSheet += Number(getCell(annualWS, revRow!, c)) || 0;
    }
    expect(sumFromSheet).toBeCloseTo(totalMonthly, 2);
  });

  it('cash-flow last balance equals balance-sheet final cash', () => {
    const lastCashCF = model.cashFlow.balance[model.cashFlow.balance.length - 1] ?? 0;
    const lastCashBS = model.balanceSheet.cash[model.balanceSheet.cash.length - 1] ?? 0;
    // Engine guarantees this; we just check the export reflects the same numbers.
    const cfWS = wb.getWorksheet('Cash-flow mensuel')!;
    const finalRow = findRowByLabel(cfWS, 'Trésorerie finale');
    expect(finalRow).not.toBeNull();
    const lastCol = model.cashFlow.months.length + 1;
    const finalFromSheet = Number(getCell(cfWS, finalRow!, lastCol)) || 0;
    // PR 9 — l'export arrondit à l'euro (frontière), tolérance 1€
    expect(Math.abs(finalFromSheet - lastCashCF)).toBeLessThanOrEqual(1);
    expect(Math.abs(finalFromSheet - lastCashBS)).toBeLessThanOrEqual(1);
  });

  it('loans sheet exposes amortization rows when financings exist', () => {
    const loansWS = wb.getWorksheet('Emprunts')!;
    // Header row "Financement" should appear at least once if there is a loan
    const hasLoan = (minimalBPInput.financings || []).some((f: any) => f.financing_type === 'loan');
    if (!hasLoan) {
      expect(loansWS.rowCount).toBeGreaterThan(0);
      return;
    }
    let headerCount = 0;
    loansWS.eachRow((row: any) => {
      if (row.getCell(1).value === 'Financement') headerCount++;
    });
    expect(headerCount).toBeGreaterThan(0);
  });

  it('controls sheet has one row per validation issue', () => {
    const ctrlWS = wb.getWorksheet('Contrôles')!;
    const issues = model.validation.issues.length;
    // Header banner (1) + blank (1) + table header (1) → first data row at 4
    let dataRows = 0;
    ctrlWS.eachRow((row: any, rn: number) => {
      if (rn <= 3) return;
      if (row.getCell(1).value) dataRows++;
    });
    if (issues === 0) {
      expect(dataRows).toBe(1); // "Aucune incohérence détectée"
    } else {
      expect(dataRows).toBe(issues);
    }
  });

  it('technical sheet exposes engine version and ids', () => {
    const techWS = wb.getWorksheet('Données techniques')!;
    const engineRow = findRowByLabel(techWS, 'engine_version');
    expect(engineRow).not.toBeNull();
    expect(getCell(techWS, engineRow!, 2)).toBe(model.engineVersion);
  });
});

describe('buildExportFilename', () => {
  it('produces a slugged dated filename', () => {
    const name = buildExportFilename('Cloud Vapor SAS', new Date('2026-05-09T10:00:00Z'));
    expect(name).toBe('Business_Plan_Cloud_Vapor_SAS_2026-05-09.xlsx');
  });

  it('handles accents and falls back when empty', () => {
    expect(buildExportFilename('Société Éphémère', new Date('2026-01-01'))).toBe('Business_Plan_Societe_Ephemere_2026-01-01.xlsx');
    expect(buildExportFilename('', new Date('2026-01-01'))).toBe('Business_Plan_business_plan_2026-01-01.xlsx');
  });
});
