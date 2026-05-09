// Emprunts — tableau d'amortissement mois par mois (un bloc par emprunt).
import type { Workbook, Worksheet } from 'exceljs';
import type { BPModelInput } from '../../../engine/types';
import { buildAllLoanSchedules } from '../../../engine/schedules/loanSchedule';
import { FONT_BOLD, FMT_EUR, TAB_COLOR, applyBaseLayout, styleHeaderRow, styleTotalRow } from '../styles';
import { format } from 'date-fns';

export function addLoansSheet(wb: Workbook, input: BPModelInput): Worksheet {
  const ws = wb.addWorksheet('Emprunts', { properties: { tabColor: { argb: TAB_COLOR.loans } } });
  applyBaseLayout(ws, 0, 1);

  ws.columns = [
    { width: 26 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 },
  ];

  const schedules = buildAllLoanSchedules(input.financings || []);
  if (schedules.length === 0) {
    ws.addRow(['Aucun emprunt dans ce business plan.']).getCell(1).font = { ...FONT_BOLD, italic: true };
    return ws;
  }

  for (const sch of schedules) {
    const fin = (input.financings || []).find((f: any) => String(f.id ?? '') === sch.financingId);
    const name = fin?.name ?? fin?.label ?? `Emprunt ${sch.financingId}`;

    const titleRow = ws.addRow([name]);
    titleRow.getCell(1).font = { ...FONT_BOLD, size: 12 };
    ws.mergeCells(titleRow.number, 1, titleRow.number, 7);

    const meta = ws.addRow([
      `Capital initial : ${sch.initialPrincipal.toFixed(0)} €`,
      `Mensualité : ${sch.monthlyPayment.toFixed(2)} €`,
      `Début : ${format(sch.startDate, 'yyyy-MM')}`,
      `Fin : ${format(sch.endDate, 'yyyy-MM')}`,
    ]);
    meta.eachCell(c => { c.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } }; });

    const head = ws.addRow(['Financement', 'Mois', 'Capital initial', 'Mensualité', 'Intérêts', 'Capital remboursé', 'Capital restant dû']);
    styleHeaderRow(head);

    for (const e of sch.entries) {
      const r = ws.addRow([
        name,
        format(e.month, 'yyyy-MM'),
        sch.initialPrincipal,
        e.payment,
        e.interest,
        e.principal,
        e.remaining,
      ]);
      [3, 4, 5, 6, 7].forEach(c => { r.getCell(c).numFmt = FMT_EUR; });
    }

    // Sub-totals for the loan
    const sumInterest = sch.entries.reduce((s, e) => s + e.interest, 0);
    const sumPrincipal = sch.entries.reduce((s, e) => s + e.principal, 0);
    const totalRow = ws.addRow(['', 'TOTAL', '', sch.entries.reduce((s, e) => s + e.payment, 0), sumInterest, sumPrincipal, '']);
    [4, 5, 6].forEach(c => { totalRow.getCell(c).numFmt = FMT_EUR; });
    styleTotalRow(totalRow, 'total');

    ws.addRow([]);
  }

  return ws;
}
