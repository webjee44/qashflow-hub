// Contrôles — sortie de validateBPModel.
import type { Workbook, Worksheet } from 'exceljs';
import type { BPFinancialModel } from '../../../engine/types';
import { FONT_BOLD, COLOR, TAB_COLOR, applyBaseLayout, styleHeaderRow } from '../styles';

const SEVERITY_LABEL: Record<string, string> = {
  error: 'Erreur',
  warning: 'Avertissement',
  info: 'Information',
};

const SEVERITY_BG: Record<string, string> = {
  error: COLOR.errorBg,
  warning: COLOR.warningBg,
  info: COLOR.infoBg,
};

export function addControlsSheet(wb: Workbook, model: BPFinancialModel): Worksheet {
  const hasErrors = model.validation.summary.errors > 0;
  const tabColor = hasErrors ? TAB_COLOR.controlsKo : TAB_COLOR.controlsOk;
  const ws = wb.addWorksheet('Contrôles', { properties: { tabColor: { argb: tabColor } } });
  applyBaseLayout(ws, 0, 1);

  ws.columns = [
    { width: 16 }, { width: 26 }, { width: 10 }, { width: 60 }, { width: 14 }, { width: 14 }, { width: 12 },
  ];

  // Summary banner
  const summary = model.validation.summary;
  const banner = ws.addRow([
    `Statut : ${model.validation.ok ? 'OK' : 'INCOHÉRENCES DÉTECTÉES'}`,
    `Erreurs : ${summary.errors}`,
    `Avertissements : ${summary.warnings}`,
    `Infos : ${summary.infos}`,
    `Engine : ${model.validation.engineVersion}`,
  ]);
  banner.eachCell(c => {
    c.font = { ...FONT_BOLD };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hasErrors ? COLOR.errorBg : COLOR.okBg } };
  });
  ws.addRow([]);

  const header = ws.addRow(['Sévérité', 'Code', 'Année', 'Message', 'Écart', 'Tolérance', 'Statut']);
  styleHeaderRow(header);

  if (model.validation.issues.length === 0) {
    const r = ws.addRow(['—', '—', '—', 'Aucune incohérence détectée.', '—', '—', 'OK']);
    r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.okBg } }; });
    return ws;
  }

  for (const iss of model.validation.issues) {
    const r = ws.addRow([
      SEVERITY_LABEL[iss.severity] ?? iss.severity,
      iss.code,
      iss.yearIndex != null ? iss.yearIndex + 1 : '—',
      iss.message,
      iss.delta ?? '—',
      iss.tolerance ?? '—',
      'KO',
    ]);
    const bg = SEVERITY_BG[iss.severity] ?? COLOR.infoBg;
    r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; });
    if (typeof iss.delta === 'number') r.getCell(5).numFmt = '#,##0.00';
    if (typeof iss.tolerance === 'number') r.getCell(6).numFmt = '#,##0.00';
  }

  return ws;
}
