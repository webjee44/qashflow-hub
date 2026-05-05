/**
 * Invariants comptables Cloud Vapor (PR 0 — diagnostic)
 *
 * Ces tests documentent les invariants qu'un business plan correct doit
 * respecter. Ils sont marqués `todo` tant que le moteur unifié
 * `computeBPModel` n'existe pas (PR 1). Au fil des PRs ils deviendront
 * `it()` actifs et passeront du rouge au vert.
 *
 * Les écarts mesurés au moment de PR 0 (depuis le PDF d'export 2026-05-05)
 * sont consignés ici pour traçabilité.
 *
 * Source des inputs : src/features/business-plan/__fixtures__/cloud-vapor.json
 */
import { describe, it } from 'vitest';

describe('Cloud Vapor — invariants comptables (PR 0 baseline)', () => {
  describe('Réconciliation trésorerie', () => {
    /**
     * Mesure PR 0 (extraite du PDF) :
     *   Plan de trésorerie année 1 : 1 858 604 €
     *   Bilan année 1               :   698 831 €
     *   Plan de financement année 1 :   505 777 €
     * Écart Cashflow vs Bilan : +1 159 773 €
     * Écart Bilan vs Funding  :   +193 054 €
     */
    it.todo('treasury.cashflowEnd[y] === treasury.balanceSheetEnd[y] (tolérance 1€)');
    it.todo('treasury.fundingPlanEnd[y] === treasury.balanceSheetEnd[y] (tolérance 1€)');
  });

  describe('Réconciliation dette financière', () => {
    /**
     * Mesure PR 0 :
     *   Dette bancaire bilan : 109 711 → 77 745 → 52 165 €
     *   Plan de financement « Remboursements emprunts » : 0 € sur 3 ans
     *   Nouvel emprunt affiché année 3 : 45 000 €
     * Δ bilan année 2 = -31 966 € sans aucun remboursement reporté.
     */
    it.todo('Δ debt[y] === Σ nouveaux emprunts[y] − Σ remboursements capital[y]');
    it.todo('Σ intérêts P&L === Σ intérêts cash flow (par année)');
  });

  describe('Réconciliation P&L vs synthèses', () => {
    /**
     * Mesure PR 0 :
     *   Page Charges (services + variables + fixes + impôts) : 2 578 991 €
     *   Charges d'exploitation P&L                            : 2 271 341 €
     * Écart : +307 650 € → double comptage probable services/fixes.
     *
     *   Page Personnel total      : 222 329 €
     *   P&L personnel total       : 222 329 €  (OK)
     *   Mais charges patronales détail page : 1 460 € vs P&L : 60 440 €
     *   Indemnités page : 43 222 € hors total → ligne orpheline.
     */
    it.todo('Σ charges page « Charges » === pnl.operatingExpenses');
    it.todo('personnel.detail.payrollTaxes === pnl.payrollTaxes');
    it.todo('personnel.detail.severance contribue au total personnel ou est exclu explicitement');
  });

  describe('Cohérence régime fiscal', () => {
    /**
     * Mesure PR 0 :
     *   bp_settings.tax_regime = 'is' (minuscule)
     *   PDF Notes affiche « Impôt sur le Revenu » (comparaison `=== 'IS'` cassée)
     *   PDF P&L calcule un IS de 178 294 € en année 1
     */
    it.todo('notes.taxRegimeLabel cohérent avec le calcul d\'impôt effectué');
    it.todo('si tax_regime = IR alors pnl.tax === 0');
  });

  describe('Hypothèses non documentées', () => {
    /**
     * Mesure PR 0 :
     *   Capital social affiché : 0 € → doit être « Non renseigné » ou saisi.
     *   Stocks : 0 € sur 3 ans malgré 1,33 M€ d'achats matières/an.
     */
    it.todo('share_capital === 0 doit afficher « Non renseigné » et déclencher un warning');
    it.todo('stocks === 0 avec achats > seuil → warning (pas d\'auto-calcul)');
  });

  describe('Cohérence cash flow vs P&L', () => {
    /**
     * Mesure PR 0 :
     *   P&L charges d'exploitation année 1   : 2 271 341 €
     *   P&L dont amortissements (non cash)   :    26 819 €
     *   ⇒ Charges cash attendues             : ~2,24 M€
     *   PDF décaissements année 1            :   925 684 €
     * Manquant : ~1,3 M€ → COGS / variables / TVA absents du cash flow.
     */
    it.todo('cashflow.outflows[y] couvre achats + services + personnel + TVA + intérêts + capital + IS + investissements');
    it.todo('cashflow.inflows[y] === CA TTC encaissé (avec délai client) + financements reçus');
  });
});
