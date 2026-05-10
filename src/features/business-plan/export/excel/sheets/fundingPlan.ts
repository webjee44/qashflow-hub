// Plan de financement — besoins vs ressources, par année.
import type { Workbook, Worksheet } from 'exceljs';
import type { BPFinancialModel } from '../../../engine/types';
import { FMT_EUR, TAB_COLOR, applyBaseLayout, styleHeaderRow, styleTotalRow } from '../styles';
import { roundEuro } from '../rounding';

export function addFundingPlanSheet(wb: Workbook, model: BPFinancialModel): Worksheet {
  const ws = wb.addWorksheet('Plan de financement', { properties: { tabColor: { argb: TAB_COLOR.funding } } });
  applyBaseLayout(ws, 1, 1);

  const years = model.fundingPlan.years;
  ws.columns = [{ width: 40 }, ...years.map(() => ({ width: 16 }))];

  const header = ws.addRow(['Poste', ...years.map(y => y)]);
  styleHeaderRow(header);

  for (const row of model.fundingPlan.rows) {
    const r = ws.addRow([row.label, ...row.values]);
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: row.indent ?? 0 };
    for (let c = 2; c <= years.length + 1; c++) r.getCell(c).numFmt = FMT_EUR;
    if (row.type === 'subtotal') styleTotalRow(r, 'subtotal');
    if (row.type === 'total') styleTotalRow(r, 'total');
    if (row.type === 'header') r.getCell(1).font = { bold: true, name: 'Calibri', size: 11 };
  }

  return ws;
}
