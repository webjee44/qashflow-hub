// Bilan annuel — actif / passif + ligne contrôle (formule Excel pure).
import type { Workbook, Worksheet } from 'exceljs';
import type { BPFinancialModel } from '../../../engine/types';
import { FMT_EUR, TAB_COLOR, applyBaseLayout, styleHeaderRow, styleTotalRow } from '../styles';

export function addBalanceSheetYearlySheet(wb: Workbook, model: BPFinancialModel): Worksheet {
  const ws = wb.addWorksheet('Bilan annuel', { properties: { tabColor: { argb: TAB_COLOR.balance } } });
  applyBaseLayout(ws, 1, 1);

  const years = model.balanceSheet.years;
  ws.columns = [{ width: 40 }, ...years.map(() => ({ width: 16 }))];

  const header = ws.addRow(['Poste', ...years.map(y => y.label)]);
  styleHeaderRow(header);

  // Use rows directly — engine provides them in canonical order (Actif puis Passif).
  let totalAssetsRow = -1;
  let totalLiabRow = -1;
  for (const row of model.balanceSheet.rows) {
    const r = ws.addRow([row.label, ...row.values]);
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: row.indent ?? 0 };
    for (let c = 2; c <= years.length + 1; c++) r.getCell(c).numFmt = FMT_EUR;
    if (row.type === 'subtotal') styleTotalRow(r, 'subtotal');
    if (row.type === 'total') {
      styleTotalRow(r, 'total');
      const lbl = row.label.toLowerCase();
      if (lbl.includes('actif')) totalAssetsRow = r.number;
      else if (lbl.includes('passif')) totalLiabRow = r.number;
    }
    if (row.type === 'header') {
      r.getCell(1).font = { bold: true, name: 'Calibri', size: 11 };
    }
  }

  // Control row — pure Excel formula (no business logic duplication).
  if (totalAssetsRow > 0 && totalLiabRow > 0) {
    const ctrl = ws.addRow(['Écart actif − passif (contrôle)', ...years.map((_, i) => {
      const col = String.fromCharCode('A'.charCodeAt(0) + 1 + i);
      return { formula: `${col}${totalAssetsRow}-${col}${totalLiabRow}` } as any;
    })]);
    for (let c = 2; c <= years.length + 1; c++) ctrl.getCell(c).numFmt = FMT_EUR;
    styleTotalRow(ctrl, 'total');
  }

  return ws;
}
