// ============================================================
// buildBPWorkbook — Excel export orchestrator
// ============================================================
// Pure function. No React, no Supabase, no recalculation.
// Consumes the *already-computed* BPFinancialModel and the raw
// BPModelInput. Produces an exceljs Workbook ready to be written
// to a Blob (browser) or buffer (node tests).
// ============================================================

import ExcelJS from 'exceljs';
import type { BPFinancialModel, BPModelInput } from '../../engine/types';
import type { ExportMeta } from './types';
import { addReadmeSheet } from './sheets/readme';
import { addAssumptionsSheet } from './sheets/assumptions';
import { addPLMonthlySheet } from './sheets/plMonthly';
import { addPLYearlySheet } from './sheets/plYearly';
import { addCashFlowMonthlySheet } from './sheets/cashFlowMonthly';
import { addBalanceSheetYearlySheet } from './sheets/balanceSheetYearly';
import { addFundingPlanSheet } from './sheets/fundingPlan';
import { addLoansSheet } from './sheets/loans';
import { addControlsSheet } from './sheets/controls';
import { addTechnicalSheet } from './sheets/technical';

export function buildBPWorkbook(
  model: BPFinancialModel,
  input: BPModelInput,
  meta: ExportMeta,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Qashflow';
  wb.created = meta.exportedAt;
  wb.modified = meta.exportedAt;

  addReadmeSheet(wb, model, meta);
  addAssumptionsSheet(wb, input);
  addPLMonthlySheet(wb, model);
  addPLYearlySheet(wb, model);
  addCashFlowMonthlySheet(wb, model);
  addBalanceSheetYearlySheet(wb, model);
  addFundingPlanSheet(wb, model);
  addLoansSheet(wb, input);
  addControlsSheet(wb, model);
  addTechnicalSheet(wb, model, meta);

  return wb;
}

/** Slug helper for filenames. */
export function buildExportFilename(companyName: string, exportedAt: Date): string {
  const slug = (companyName || 'business-plan')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'business_plan';
  const date = exportedAt.toISOString().slice(0, 10);
  return `Business_Plan_${slug}_${date}.xlsx`;
}
