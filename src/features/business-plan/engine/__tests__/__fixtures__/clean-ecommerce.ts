// ============================================================
// PR 0 — Fixture e-commerce propre
// ============================================================
// BP minimal cohérent qui DOIT passer vert une fois les PR 1→9
// terminées :
//   - capital social explicite (100 000 €)
//   - trésorerie d'ouverture cohérente avec le capital
//   - stocks renseignés (initial 100, achats 500, final 150 → 450 consommés)
//   - 1 salarié 3 000 € @ 45 % patronal
//   - 1 emprunt 50 000 € / 60 mois / 4 %
//   - charges fixes + variables, TVA 20 %
//
// Tant que les PR 1→9 ne sont pas livrées, les invariants déclarés
// dans les fichiers de tests `*.red.test.ts` restent RED via
// `it.fails(...)` et matérialisent la dette à payer.
// ============================================================
import type { BPModelInput } from '../../types';

// `initial_capital` sera introduit en PR 2 sur BPSettingsInput.
// On l'embarque dès maintenant via un cast pour ne pas refactorer
// la fixture entre PR 0 et PR 2.
type WithCapital = BPModelInput & {
  settings: BPModelInput['settings'] & { initial_capital?: number };
};

export const cleanEcommerceBPInput: WithCapital = {
  settings: {
    initial_cash: 100000,
    initial_capital: 100000,
    customer_payment_delay: 30,
    supplier_payment_delay: 30,
    tax_regime: 'IS',
    is_pme: true,
    fiscal_year_start_month: 1,
    fiscal_year_start_day: 1,
    bp_start_date: '2025-01-01',
    bp_years: 3,
    first_fiscal_year_end_date: null,
    show_stocks: true,
    show_financing: true,
    show_funding_plan: true,
  },
  streams: [
    {
      id: 'stream-1',
      name: 'Vente en ligne',
      model: 'one_off',
      revenue_type: 'merchandise',
      monthly_price: 8000,
      growth_rate: 0.05,
      growth_rate_year2: 0.10,
      growth_rate_year3: 0.08,
      growth_rate_year4: 0.05,
      has_purchase_cost: false,
      purchase_price: 0,
      tva_rate: 20,
      vat_rate: 0.20,
    },
  ],
  forecasts: [
    { stream_id: 'stream-1', month: '2025-01-01', amount: 8000 },
    { stream_id: 'stream-1', month: '2025-02-01', amount: 8500 },
  ],
  fixedExpenses: [
    {
      id: 'fx-1',
      name: 'Loyer',
      monthly_amount: 1200,
      payment_frequency: 'monthly',
      start_date: '2025-01-01',
      end_date: null,
      tva_rate: 20,
      vat_rate: 0.20,
      pcg_account: '613',
      pcg_subcategory: '613',
    },
  ],
  variableExpenses: [],
  personnel: [
    {
      id: 'p-1',
      name: 'Salarié #1',
      worker_type: 'employee',
      gross_salary: 3000,
      employer_charges_rate: 0.45,
      start_date: '2025-01-01',
      end_date: null,
    },
  ],
  directors: [],
  investments: [],
  financings: [
    {
      id: 'L1',
      name: 'Emprunt bancaire',
      financing_type: 'loan',
      amount: 50000,
      interest_rate: 4,
      duration_months: 60,
      start_date: '2025-01-01',
    },
  ],
  // Stock initial 100, achats 500, stock final 150
  // → consommé = 100 + 500 − 150 = 450
  stocks: [
    {
      id: 'st-1',
      name: 'Marchandises',
      fiscal_year: 1,
      initial_stock: 100,
      purchase_amount: 500,
      final_stock: 150,
    },
  ],
};
