// Minimal synthetic BPModelInput fixture for golden snapshot tests.
// Designed to exercise: 1 stream + monthly forecast, 1 fixed expense,
// 1 personnel, 1 director, 1 investment with depreciation, 1 loan.
import type { BPModelInput } from '../../types';

export const minimalBPInput: BPModelInput = {
  settings: {
    initial_cash: 50000,
    customer_payment_delay: 30,
    supplier_payment_delay: 30,
    tax_regime: 'IS',
    is_pme: true,
    fiscal_year_start_month: 1,
    fiscal_year_start_day: 1,
    bp_start_date: '2025-01-01',
    bp_years: 3,
    first_fiscal_year_end_date: null,
    show_stocks: false,
    show_financing: true,
    show_funding_plan: true,
  },
  streams: [
    {
      id: 'stream-1',
      name: 'SaaS recurring',
      model: 'one_off',
      revenue_type: 'production',
      monthly_price: 10000,
      growth_rate: 0.05,
      growth_rate_year2: 0.10,
      growth_rate_year3: 0.08,
      growth_rate_year4: 0.05,
      has_purchase_cost: false,
      purchase_price: 0,
      tva_rate: 20,
    },
  ],
  forecasts: [
    { stream_id: 'stream-1', month: '2025-01-01', amount: 10000 },
    { stream_id: 'stream-1', month: '2025-02-01', amount: 12000 },
  ],
  fixedExpenses: [
    {
      id: 'fx-1',
      name: 'Rent',
      monthly_amount: 1500,
      payment_frequency: 'monthly',
      start_date: '2025-01-01',
      end_date: null,
      tva_rate: 20,
      pcg_account: '613',
    },
  ],
  variableExpenses: [],
  personnel: [
    {
      id: 'p-1',
      name: 'Dev #1',
      worker_type: 'employee',
      gross_salary: 4000,
      employer_charges_rate: 0.45,
      start_date: '2025-01-01',
      end_date: null,
    },
  ],
  directors: [
    {
      id: 'd-1',
      name: 'Founder',
      monthly_remuneration: 3000,
      charges_rate: 0.45,
      start_date: '2025-01-01',
      end_date: null,
    },
  ],
  investments: [
    {
      id: 'i-1',
      name: 'Laptops',
      purchase_amount: 6000,
      purchase_date: '2025-01-01',
      depreciation_years: 3,
    },
  ],
  financings: [
    {
      id: 'L1',
      name: 'Bank loan',
      financing_type: 'loan',
      amount: 100000,
      interest_rate: 4,
      duration_months: 60,
      start_date: '2025-01-01',
    },
  ],
  stocks: [],
};
