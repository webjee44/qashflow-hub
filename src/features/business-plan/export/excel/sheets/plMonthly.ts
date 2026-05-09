// P&L mensuel — line per PL totals row, column per month.
import type { Workbook, Worksheet } from 'exceljs';
import type { BPFinancialModel } from '../../../engine/types';
import { FMT_EUR, TAB_COLOR, applyBaseLayout, styleHeaderRow, styleTotalRow } from '../styles';
import { format } from 'date-fns';

interface LineDef {
  label: string;
  key: keyof BPFinancialModel['pl']['totals'];
  variant?: 'subtotal' | 'total';
}

// Monthly values are not directly stored in pl.totals (which is per year).
// We reconstruct monthly values from pl.rows (which IS monthly when present).
// Strategy: use pl.years[].months for the month list, and rely on rows where type === 'item' or 'subtotal'.
// To avoid duplicating engine logic, we expose only the monthly row data already computed by computePL.
const ROW_LABELS: Array<{ pcgPrefix?: string; label: string; type?: string }> = [];

export function addPLMonthlySheet(wb: Workbook, model: BPFinancialModel): Worksheet {
  const ws = wb.addWorksheet('P&L mensuel', { properties: { tabColor: { argb: TAB_COLOR.pl } } });
  applyBaseLayout(ws, 1, 1);

  // Build month list from pl.years
  const months: Date[] = [];
  for (const y of model.pl.years) months.push(...y.months);

  ws.columns = [
    { width: 40 },
    ...months.map(() => ({ width: 12 })),
  ];

  const header = ws.addRow(['Poste', ...months.map(m => format(m, 'MMM yy'))]);
  styleHeaderRow(header);

  // Use pl.rows directly — they are already structured by the engine.
  for (const row of model.pl.rows) {
    if (!row.values || row.values.length === 0) continue;
    // values length === months count when monthly; if it equals years count it's annual aggregated row → skip here
    if (row.values.length !== months.length) continue;
    const r = ws.addRow([row.label, ...row.values]);
    r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: row.indent ?? 0 };
    for (let c = 2; c <= months.length + 1; c++) {
      r.getCell(c).numFmt = FMT_EUR;
    }
    if (row.type === 'subtotal') styleTotalRow(r, 'subtotal');
    if (row.type === 'total' || row.type === 'sig') styleTotalRow(r, 'total');
  }

  return ws;
}
