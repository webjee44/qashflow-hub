// P&L annuel — same structure aggregated per fiscal year.
import type { Workbook, Worksheet } from 'exceljs';
import type { BPFinancialModel } from '../../../engine/types';
import { FMT_EUR, TAB_COLOR, applyBaseLayout, styleHeaderRow, styleTotalRow } from '../styles';
import { roundEuro } from '../rounding';

export function addPLYearlySheet(wb: Workbook, model: BPFinancialModel): Worksheet {
  const ws = wb.addWorksheet('P&L annuel', { properties: { tabColor: { argb: TAB_COLOR.pl } } });
  applyBaseLayout(ws, 1, 1);

  const years = model.pl.years;
  ws.columns = [{ width: 40 }, ...years.map(() => ({ width: 16 }))];

  const header = ws.addRow(['Poste', ...years.map(y => y.label)]);
  styleHeaderRow(header);

  // Build canonical lines from pl.totals (engine guarantees length === years.length)
  const t = model.pl.totals;
  const LINES: Array<{ label: string; values: number[]; type?: 'subtotal' | 'total' }> = [
    { label: 'Ventes de marchandises', values: t.merchandiseSales },
    { label: 'Production vendue', values: t.productionSold },
    { label: 'Subventions d\'exploitation', values: t.operatingGrants },
    { label: "Chiffre d'affaires", values: t.revenue, type: 'subtotal' },
    { label: 'Achats de marchandises', values: t.merchandisePurchases },
    { label: 'Variation de stocks', values: t.stockVariation },
    { label: 'Marge commerciale', values: t.commercialMargin, type: 'subtotal' },
    { label: 'Services extérieurs', values: t.externalServices },
    { label: 'Valeur ajoutée', values: t.valueAdded, type: 'subtotal' },
    { label: 'Impôts et taxes', values: t.taxes },
    { label: 'Charges de personnel', values: t.personnelCosts },
    { label: 'Charges dirigeants', values: t.directorsCosts },
    { label: 'Charges sociales / patronales', values: t.payrollTaxes },
    { label: 'EBITDA', values: t.ebitda, type: 'subtotal' },
    { label: 'Dotations aux amortissements', values: t.depreciation },
    { label: "Résultat d'exploitation", values: t.operatingResult, type: 'subtotal' },
    { label: 'Résultat financier', values: t.financialResult },
    { label: 'Résultat avant impôt', values: t.netResultBeforeTax, type: 'subtotal' },
    { label: 'Impôt sur les sociétés', values: t.corporateTax },
    { label: 'Résultat net', values: t.netResult, type: 'total' },
  ];

  for (const line of LINES) {
    const r = ws.addRow([line.label, ...line.values]);
    for (let c = 2; c <= years.length + 1; c++) r.getCell(c).numFmt = FMT_EUR;
    if (line.type) styleTotalRow(r, line.type);
  }

  return ws;
}
