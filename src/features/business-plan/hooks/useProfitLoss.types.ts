// Type definitions extracted from useProfitLoss to avoid circular imports
// with the engine.

export interface PLRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total' | 'sig';
  values: number[];
  isExpense?: boolean;
  indent?: number;
  sectionType?: 'revenue' | 'expense' | 'result';
  pcgCode?: string;
  isSIG?: boolean;
  percentOfRevenue?: number[];
}

export interface FiscalYear {
  start: Date;
  end: Date;
  label: string;
  months: Date[];
}

export interface PLData {
  years: FiscalYear[];
  rows: PLRow[];
  totals: {
    merchandiseSales: number[];
    productionSold: number[];
    operatingGrants: number[];
    revenue: number[];
    merchandisePurchases: number[];
    stockVariation: number[];
    externalServices: number[];
    taxes: number[];
    personnel: number[];
    depreciation: number[];
    cogs: number[];
    fixedExpenses: number[];
    variableExpenses: number[];
    personnelCosts: number[];
    directorsCosts: number[];
    leaseExpenses: number[];
    payrollTaxes: number[];
    severancePayments: number[];
    commercialMargin: number[];
    valueAdded: number[];
    ebitda: number[];
    operatingResult: number[];
    financialResult: number[];
    netResultBeforeTax: number[];
    corporateTax: number[];
    netResult: number[];
  };
  tva: {
    collected: number[];
    deductible: number[];
    balance: number[];
  };
}
