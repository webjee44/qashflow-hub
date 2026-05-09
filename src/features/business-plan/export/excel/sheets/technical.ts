// Données techniques — IDs, version, hash compact des totaux.
import type { Workbook, Worksheet } from 'exceljs';
import type { BPFinancialModel } from '../../../engine/types';
import type { ExportMeta } from '../types';
import { FONT_BOLD, TAB_COLOR, applyBaseLayout, styleHeaderRow } from '../styles';
import { format } from 'date-fns';

/** Stable, fast non-crypto hash (FNV-1a 32-bit). Pure, no deps. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function addTechnicalSheet(wb: Workbook, model: BPFinancialModel, meta: ExportMeta): Worksheet {
  const ws = wb.addWorksheet('Données techniques', { properties: { tabColor: { argb: TAB_COLOR.technical } } });
  applyBaseLayout(ws, 0, 0);
  ws.columns = [{ width: 28 }, { width: 70 }];

  const compactTotals = {
    revenue: model.pl.totals.revenue,
    netResult: model.pl.totals.netResult,
    finalCash: model.cashFlow.balance[model.cashFlow.balance.length - 1] ?? 0,
    debt: model.balanceSheet.totals.financialDebts,
    equity: model.balanceSheet.totals.equity,
  };
  const json = JSON.stringify(compactTotals);
  const hash = fnv1a(json);

  const head = ws.addRow(['Clé', 'Valeur']);
  styleHeaderRow(head);

  const rows: Array<[string, string]> = [
    ['business_plan_id', meta.businessPlanId ?? '—'],
    ['company_id', meta.companyId ?? '—'],
    ['engine_version', model.engineVersion],
    ['exported_at', format(meta.exportedAt, "yyyy-MM-dd'T'HH:mm:ssXXX")],
    ['model_hash', hash],
    ['totals_json', json],
  ];
  for (const [k, v] of rows) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { ...FONT_BOLD };
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  }

  return ws;
}
