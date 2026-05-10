// README sheet — overview, metadata, optional warning banner.
import type { Workbook, Worksheet } from 'exceljs';
import type { BPFinancialModel } from '../../../engine/types';
import type { ExportMeta } from '../types';
import { FONT_BASE, FONT_BOLD, FONT_TITLE, TAB_COLOR, applyBaseLayout, styleHeaderRow } from '../styles';
import { format } from 'date-fns';

const SHEETS_DESCRIPTION: Array<{ name: string; description: string; source: string }> = [
  { name: 'Synthèse', description: 'KPI annuels + matrice rouge/vert des contrôles d\'intégrité (point d\'entrée comptable)', source: 'computeBPModel + validateBPModel' },
  { name: 'Hypothèses', description: "Données saisies (paramètres, revenus, charges, personnel avec taux brut DB + taux normalisé moteur, investissements, financements)", source: 'BPModelInput' },
  { name: 'P&L mensuel', description: 'Compte de résultat détaillé mois par mois (source de vérité — l\'annuel en est la somme)', source: 'computeBPModel.pl.rows monthly' },
  { name: 'P&L annuel', description: 'Compte de résultat agrégé par exercice fiscal', source: 'computeBPModel.pl.totals' },
  { name: 'Cash-flow mensuel', description: 'Flux de trésorerie mensuel détaillé (encaissements / décaissements)', source: 'computeBPModel.cashFlow' },
  { name: 'Bilan annuel', description: 'Actif et passif par exercice + ligne de contrôle (formule Excel actif − passif)', source: 'computeBPModel.balanceSheet' },
  { name: 'Plan de financement', description: 'Besoins vs ressources par exercice (capital social distinct de la trésorerie initiale)', source: 'computeBPModel.fundingPlan' },
  { name: 'Emprunts', description: "Tableau d'amortissement mensuel par emprunt", source: 'buildLoanSchedule' },
  { name: 'Contrôles', description: 'Liste exhaustive des incohérences détectées (réconciliation, équilibres)', source: 'validateBPModel' },
  { name: 'Données techniques', description: "Identifiants, version moteur et hash d'export", source: 'meta' },
];

export function addReadmeSheet(wb: Workbook, model: BPFinancialModel, meta: ExportMeta): Worksheet {
  const ws = wb.addWorksheet('README', { properties: { tabColor: { argb: TAB_COLOR.readme } } });
  applyBaseLayout(ws, 0, 0);

  ws.columns = [{ width: 32 }, { width: 70 }, { width: 28 }];

  ws.addRow(['Business Plan — Export Excel d\'audit']).getCell(1).font = { ...FONT_TITLE };
  ws.mergeCells(1, 1, 1, 3);
  ws.addRow([]);

  // Metadata
  const meta_pairs: Array<[string, string]> = [
    ['Société', meta.companyName || '—'],
    ['Date d\'export', format(meta.exportedAt, 'yyyy-MM-dd HH:mm')],
    ['Devise', meta.currency || 'EUR'],
    ['Période couverte', `${model.pl.years[0]?.label ?? '?'} → ${model.pl.years[model.pl.years.length - 1]?.label ?? '?'}`],
    ['Nb d\'exercices', String(model.pl.years.length)],
    ['Version du moteur BP', model.engineVersion],
    ['Statut validation', model.validation.ok ? 'OK' : `${model.validation.summary.errors} erreur(s), ${model.validation.summary.warnings} avertissement(s)`],
  ];
  for (const [k, v] of meta_pairs) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { ...FONT_BOLD };
    r.getCell(2).font = { ...FONT_BASE };
  }
  ws.addRow([]);

  // Warning banner if critical issues
  if (model.validation.summary.errors > 0) {
    const warnRow = ws.addRow(['⚠ Document non finalisé — incohérences détectées. Voir l\'onglet "Contrôles".']);
    warnRow.getCell(1).font = { ...FONT_BOLD, color: { argb: 'FFB91C1C' } };
    warnRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE7E9' } };
    ws.mergeCells(warnRow.number, 1, warnRow.number, 3);
    ws.addRow([]);
  }

  // Disclaimer
  const discRow = ws.addRow(['Avertissement : ce fichier est un export de lecture/audit. Il n\'est pas réimportable.']);
  discRow.getCell(1).font = { ...FONT_BASE, italic: true, color: { argb: 'FF475569' } };
  ws.mergeCells(discRow.number, 1, discRow.number, 3);
  ws.addRow([]);

  // Sheets table
  const headerRow = ws.addRow(['Onglet', 'Description', 'Source']);
  styleHeaderRow(headerRow);
  for (const s of SHEETS_DESCRIPTION) {
    ws.addRow([s.name, s.description, s.source]);
  }

  return ws;
}
