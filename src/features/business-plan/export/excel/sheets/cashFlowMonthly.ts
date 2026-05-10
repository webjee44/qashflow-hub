// Cash-flow mensuel — encaissements / décaissements détaillés.
import type { Workbook, Worksheet } from 'exceljs';
import type { BPFinancialModel } from '../../../engine/types';
import { FMT_EUR, TAB_COLOR, applyBaseLayout, styleHeaderRow, styleTotalRow } from '../styles';
import { roundEuro } from '../rounding';
import { format } from 'date-fns';

export function addCashFlowMonthlySheet(wb: Workbook, model: BPFinancialModel): Worksheet {
  const ws = wb.addWorksheet('Cash-flow mensuel', { properties: { tabColor: { argb: TAB_COLOR.cash } } });
  applyBaseLayout(ws, 1, 1);

  const months = model.cashFlow.months;
  ws.columns = [{ width: 38 }, ...months.map(() => ({ width: 12 }))];

  const header = ws.addRow(['Poste', ...months.map(m => format(m, 'MMM yy'))]);
  styleHeaderRow(header);

  const cf = model.cashFlow;
  // Initial balance row: previous cumulative balance shifted by 1
  const openings = months.map((_, i) => i === 0 ? cf.initialBalance : cf.balance[i - 1]);

  const LINES: Array<{ label: string; values: number[]; type?: 'subtotal' | 'total' }> = [
    { label: 'Trésorerie initiale', values: openings, type: 'subtotal' },
    { label: 'Encaissements clients', values: cf.inflows.revenue },
    { label: 'Apports en capital', values: cf.inflows.capitalContributions },
    { label: 'Comptes courants associés', values: cf.inflows.currentAccountContributions },
    { label: 'Emprunts débloqués', values: cf.inflows.loanDisbursements },
    { label: 'Subventions', values: cf.inflows.grants },
    { label: 'Total encaissements', values: cf.inflows.total, type: 'subtotal' },
    { label: 'Charges fixes', values: cf.outflows.fixedExpenses },
    { label: 'Charges variables', values: cf.outflows.variableExpenses },
    { label: 'Salaires nets', values: cf.outflows.personnel },
    { label: 'Dirigeants', values: cf.outflows.directors },
    { label: 'Charges sociales', values: cf.outflows.payrollTaxes },
    { label: 'TVA payée', values: cf.outflows.vatPayments },
    { label: 'IS payé', values: cf.outflows.taxPayments },
    { label: 'Investissements', values: cf.outflows.investments },
    { label: 'Mensualités emprunts', values: cf.outflows.loanPayments },
    { label: 'Loyers crédit-bail', values: cf.outflows.leasePayments },
    { label: 'Total décaissements', values: cf.outflows.total, type: 'subtotal' },
    { label: 'Flux net', values: cf.netFlow, type: 'subtotal' },
    { label: 'Trésorerie finale', values: cf.balance, type: 'total' },
  ];

  for (const line of LINES) {
    const r = ws.addRow([line.label, ...line.values.map(roundEuro)]);
    for (let c = 2; c <= months.length + 1; c++) r.getCell(c).numFmt = FMT_EUR;
    if (line.type) styleTotalRow(r, line.type);
  }

  return ws;
}
