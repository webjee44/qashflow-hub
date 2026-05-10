// ============================================================
// Synthèse — KPI clés + matrice d'état des contrôles (PR 8)
// ============================================================
// Onglet d'entrée du classeur, conçu pour qu'un comptable
// vérifie en 30 secondes :
//   1. les KPI annuels (CA, marge, résultat, trésorerie finale, dette)
//   2. l'état rouge/vert de chaque invariant comptable critique
//   3. la liste explicite des contrôles KO le cas échéant
// ============================================================

import type { Workbook, Worksheet } from 'exceljs';
import type { BPFinancialModel } from '../../../engine/types';
import {
  FMT_EUR, FMT_PCT, FONT_BOLD, FONT_TITLE, COLOR, TAB_COLOR,
  applyBaseLayout, styleHeaderRow, styleTotalRow,
} from '../styles';
import { roundEuro } from '../rounding';

const CONTROL_DEFINITIONS: Array<{
  code: string;
  label: string;
  rationale: string;
}> = [
  { code: 'BS_BALANCE_OK', label: 'Bilan équilibré (|Actif − Passif| < 1 €)', rationale: 'Invariant comptable fondamental' },
  { code: 'CF_BS_CASH_MATCH', label: 'Cash-flow = trésorerie du bilan', rationale: 'Réconciliation flux ↔ stocks' },
  { code: 'FP_CASH_VARIATION_MATCH', label: 'Plan de financement = variation de trésorerie', rationale: 'Réconciliation besoins/ressources' },
  { code: 'PL_MONTHLY_ANNUAL_MATCH', label: 'P&L annuel = somme P&L mensuel', rationale: 'monthlyRows = source de vérité' },
  { code: 'OPENING_CONTRA_PARTY_OK', label: 'Trésorerie/stock initial avec contrepartie', rationale: 'Pas d\'équilibrage silencieux' },
  { code: 'PAYROLL_RATE_PROVIDED', label: 'Taux charges patronales renseigné', rationale: 'Évite le 0 € artificiel' },
];

export function addSynthesisSheet(wb: Workbook, model: BPFinancialModel): Worksheet {
  const ws = wb.addWorksheet('Synthèse', { properties: { tabColor: { argb: TAB_COLOR.readme } } });
  applyBaseLayout(ws, 0, 1);
  ws.columns = [{ width: 42 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 24 }];

  // Title
  const title = ws.addRow(['Synthèse — Vue comptable']);
  title.getCell(1).font = { ...FONT_TITLE };
  ws.mergeCells(title.number, 1, title.number, 6);
  ws.addRow([]);

  // ── KPI annuels ──
  const years = model.pl.years.map(y => y.label);
  const kpiHeader = ws.addRow(['KPI', ...years]);
  styleHeaderRow(kpiHeader);

  const totals = model.pl.totals;
  const cash = model.balanceSheet.cash;
  const debts = model.balanceSheet.totals.financialDebts;

  const kpiRows: Array<{ label: string; values: number[]; fmt: string; type?: 'subtotal' | 'total' }> = [
    { label: "Chiffre d'affaires", values: totals.revenue ?? [], fmt: FMT_EUR },
    { label: "Marge brute", values: (totals.grossMargin ?? totals.revenue ?? []).map((v: number) => v), fmt: FMT_EUR },
    { label: "EBE / EBITDA", values: (totals.ebe ?? totals.ebitda ?? []).map((v: number) => v), fmt: FMT_EUR, type: 'subtotal' },
    { label: "Résultat net", values: totals.netResult ?? [], fmt: FMT_EUR, type: 'total' },
    { label: "Trésorerie finale", values: cash, fmt: FMT_EUR },
    { label: "Dettes financières", values: debts, fmt: FMT_EUR },
  ];

  for (const kpi of kpiRows) {
    const padded = years.map((_, i) => roundEuro(kpi.values[i] ?? 0));
    const r = ws.addRow([kpi.label, ...padded]);
    for (let c = 2; c <= years.length + 1; c++) r.getCell(c).numFmt = kpi.fmt;
    if (kpi.type) styleTotalRow(r, kpi.type);
  }

  // Marge nette en %
  const marginPct = years.map((_, i) => {
    const rev = totals.revenue?.[i] ?? 0;
    const net = totals.netResult?.[i] ?? 0;
    return rev !== 0 ? net / rev : 0;
  });
  const marginRow = ws.addRow(['Marge nette (%)', ...marginPct]);
  for (let c = 2; c <= years.length + 1; c++) marginRow.getCell(c).numFmt = FMT_PCT;

  ws.addRow([]);

  // ── Matrice de contrôles ──
  const ctrlTitle = ws.addRow(['Contrôles d\'intégrité']);
  ctrlTitle.getCell(1).font = { ...FONT_BOLD, size: 12 };
  ws.mergeCells(ctrlTitle.number, 1, ctrlTitle.number, 6);

  const ctrlHeader = ws.addRow(['Contrôle', 'Statut', 'Sévérité', 'Justification', 'Écart max (€)', 'Code']);
  styleHeaderRow(ctrlHeader);

  const issuesByCode = new Map<string, typeof model.validation.issues>();
  for (const iss of model.validation.issues) {
    const list = issuesByCode.get(iss.code) ?? [];
    list.push(iss);
    issuesByCode.set(iss.code, list);
  }

  for (const def of CONTROL_DEFINITIONS) {
    const issues = issuesByCode.get(def.code) ?? [];
    const ko = issues.length > 0;
    const severity = ko ? (issues.some(i => i.severity === 'error') ? 'Erreur' : issues[0].severity === 'warning' ? 'Avertissement' : 'Info') : '—';
    const maxDelta = ko ? Math.max(...issues.map(i => Math.abs(Number(i.delta) || 0))) : 0;
    const r = ws.addRow([def.label, ko ? 'KO' : 'OK', severity, def.rationale, roundEuro(maxDelta), def.code]);
    const bg = ko ? (severity === 'Erreur' ? COLOR.errorBg : COLOR.warningBg) : COLOR.okBg;
    r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; });
    r.getCell(5).numFmt = FMT_EUR;
    r.getCell(2).font = { ...FONT_BOLD };
  }

  // Contrôles non listés mais présents dans validation.issues → on les ajoute en queue.
  const knownCodes = new Set(CONTROL_DEFINITIONS.map(d => d.code));
  for (const [code, issues] of issuesByCode) {
    if (knownCodes.has(code)) continue;
    const severity = issues[0].severity === 'error' ? 'Erreur' : issues[0].severity === 'warning' ? 'Avertissement' : 'Info';
    const maxDelta = Math.max(...issues.map(i => Math.abs(Number(i.delta) || 0)));
    const r = ws.addRow([issues[0].message, 'KO', severity, '—', roundEuro(maxDelta), code]);
    const bg = severity === 'Erreur' ? COLOR.errorBg : COLOR.warningBg;
    r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; });
    r.getCell(5).numFmt = FMT_EUR;
  }

  ws.addRow([]);
  const footer = ws.addRow([
    `Statut global : ${model.validation.ok ? 'OK — exportable' : 'KO — corriger les contrôles avant remise comptable'}`,
  ]);
  footer.getCell(1).font = { ...FONT_BOLD, color: { argb: model.validation.ok ? 'FF15803D' : 'FFB91C1C' } };
  ws.mergeCells(footer.number, 1, footer.number, 6);

  return ws;
}
