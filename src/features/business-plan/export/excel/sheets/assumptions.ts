// Hypothèses sheet — raw inputs from BPModelInput.
// Multiple sub-tables, each preceded by a section header.
import type { Workbook, Worksheet, Row } from 'exceljs';
import type { BPModelInput } from '../../../engine/types';
import { FONT_BOLD, FMT_EUR, FMT_PCT, TAB_COLOR, applyBaseLayout, styleHeaderRow } from '../styles';

function addSectionHeader(ws: Worksheet, title: string) {
  ws.addRow([]);
  const r = ws.addRow([title]);
  r.getCell(1).font = { ...FONT_BOLD, size: 12, color: { argb: 'FF1E293B' } };
  return r;
}

function addTable(ws: Worksheet, headers: string[], rows: Array<Array<string | number | null | undefined>>, eurCols: number[] = [], pctCols: number[] = []) {
  const head = ws.addRow(headers);
  styleHeaderRow(head);
  for (const row of rows) {
    const r = ws.addRow(row);
    eurCols.forEach(c => { r.getCell(c).numFmt = FMT_EUR; });
    pctCols.forEach(c => { r.getCell(c).numFmt = FMT_PCT; });
  }
}

export function addAssumptionsSheet(wb: Workbook, input: BPModelInput): Worksheet {
  const ws = wb.addWorksheet('Hypothèses', { properties: { tabColor: { argb: TAB_COLOR.assumptions } } });
  applyBaseLayout(ws, 0, 0);
  ws.columns = [
    { width: 38 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
  ];

  // Paramètres généraux
  addSectionHeader(ws, 'Paramètres généraux');
  const s = input.settings;
  addTable(ws, ['Paramètre', 'Valeur'], [
    ['Date de début BP', s.bp_start_date ?? '—'],
    ['Durée BP (années)', s.bp_years],
    ['Trésorerie initiale', s.initial_cash],
    ['Régime fiscal', s.tax_regime],
    ['PME (taux IS réduit)', s.is_pme ? 'oui' : 'non'],
    ['Délai règlement clients (j)', s.customer_payment_delay],
    ['Délai règlement fournisseurs (j)', s.supplier_payment_delay],
    ['Début exercice fiscal', `${String(s.fiscal_year_start_day).padStart(2, '0')}/${String(s.fiscal_year_start_month).padStart(2, '0')}`],
    ['1er exercice — date de fin', s.first_fiscal_year_end_date ?? '—'],
  ], [2]);

  // Revenus
  addSectionHeader(ws, 'Sources de revenus');
  addTable(ws, ['Nom', 'Type', 'Modèle', 'Prix unitaire', 'TVA', 'Croissance Y2', 'Croissance Y3', 'Marge / Coût d\'achat'], (input.streams || []).map((r: any) => [
    r.name ?? r.label ?? '—',
    r.revenue_type ?? '—',
    r.model ?? '—',
    Number(r.monthly_price ?? r.unit_price ?? 0),
    Number(r.tva_rate ?? 0) / 100,
    Number(r.growth_rate_year2 ?? r.growth_rate ?? 0),
    Number(r.growth_rate_year3 ?? 0),
    r.has_purchase_cost ? Number(r.purchase_price ?? 0) : '—',
  ]), [4, 8], [5, 6, 7]);

  // Charges fixes
  addSectionHeader(ws, 'Charges fixes');
  addTable(ws, ['Nom', 'Catégorie PCG', 'Montant', 'Fréquence', 'Début', 'Fin', 'TVA'], (input.fixedExpenses || []).map((e: any) => [
    e.name ?? '—',
    e.pcg_subcategory ?? e.category ?? '—',
    Number(e.amount ?? 0),
    e.frequency ?? 'mensuel',
    e.start_date ?? '—',
    e.end_date ?? '—',
    Number(e.tva_rate ?? 0) / 100,
  ]), [3], [7]);

  // Charges variables
  addSectionHeader(ws, 'Charges variables');
  addTable(ws, ['Nom', 'Catégorie PCG', 'Base', '% / Montant', 'TVA'], (input.variableExpenses || []).map((e: any) => [
    e.name ?? '—',
    e.pcg_subcategory ?? e.category ?? '—',
    e.calculation_base ?? e.base ?? 'CA',
    e.percentage != null ? Number(e.percentage) / 100 : Number(e.amount ?? 0),
    Number(e.tva_rate ?? 0) / 100,
  ]), [], [4, 5]);

  // Personnel
  addSectionHeader(ws, 'Personnel');
  addTable(ws, ['Poste', 'Salaire brut mensuel', 'Charges patronales', 'Date début', 'Date fin'], (input.personnel || []).map((p: any) => [
    p.position ?? p.name ?? '—',
    Number(p.gross_salary ?? p.salary ?? 0),
    Number(p.employer_charges ?? p.employer_tax_rate ?? 0),
    p.start_date ?? '—',
    p.end_date ?? '—',
  ]), [2, 3]);

  // Dirigeants
  addSectionHeader(ws, 'Dirigeants');
  addTable(ws, ['Nom', 'Rémunération mensuelle', 'Charges', 'Date début', 'Date fin'], (input.directors || []).map((d: any) => [
    d.name ?? '—',
    Number(d.gross_salary ?? d.compensation ?? 0),
    Number(d.employer_charges ?? d.charges ?? 0),
    d.start_date ?? '—',
    d.end_date ?? '—',
  ]), [2, 3]);

  // Investissements
  addSectionHeader(ws, 'Investissements');
  addTable(ws, ['Libellé', 'Montant', 'Date', 'Durée amortissement (mois)'], (input.investments || []).map((i: any) => [
    i.name ?? i.label ?? '—',
    Number(i.amount ?? 0),
    i.purchase_date ?? i.start_date ?? '—',
    Number(i.depreciation_duration_months ?? i.duration_months ?? 0),
  ]), [2]);

  // Financements
  addSectionHeader(ws, 'Financements');
  addTable(ws, ['Libellé', 'Type', 'Montant', 'Taux', 'Durée (mois)', 'Date démarrage'], (input.financings || []).map((f: any) => [
    f.name ?? f.label ?? '—',
    f.financing_type ?? '—',
    Number(f.amount ?? 0),
    Number(f.interest_rate ?? 0) / 100,
    Number(f.duration_months ?? 0),
    f.start_date ?? '—',
  ]), [3], [4]);

  // Stocks
  if ((input.stocks || []).length > 0) {
    addSectionHeader(ws, 'Stocks');
    addTable(ws, ['Libellé', 'Valeur initiale', 'Rotation (jours)'], input.stocks.map((s: any) => [
      s.name ?? '—',
      Number(s.initial_value ?? 0),
      Number(s.rotation_days ?? 0),
    ]), [2]);
  }

  return ws;
}
