import { useMemo } from 'react';
import { useProfitLoss } from './useProfitLoss';
import { useInvestments } from './useInvestments';
import { useFinancings } from './useFinancings';
import { useBalanceSheet } from './useBalanceSheet';
import { useBPSettings } from './useBPSettings';

export interface FundingPlanRow {
  label: string;
  type: 'header' | 'item' | 'subtotal' | 'total';
  values: number[];
  isNeed?: boolean;
  indent?: number;
}

export interface FundingPlanData {
  years: string[];
  rows: FundingPlanRow[];
  needs: {
    investments: number[];
    bfrVariation: number[];
    loanRepayments: number[];
    dividends: number[];
    totalNeeds: number[];
  };
  resources: {
    caf: number[];
    capitalContributions: number[];
    newLoans: number[];
    currentAccounts: number[];
    totalResources: number[];
  };
  balance: number[];
  cumulativeBalance: number[];
}

export function useFundingPlan() {
  const { data: plData, isLoading: plLoading } = useProfitLoss();
  const { investments, isLoading: investmentsLoading } = useInvestments();
  const { financings, isLoading: financingsLoading } = useFinancings();
  const { data: bsData, isLoading: bsLoading } = useBalanceSheet();
  const { settings, isLoading: settingsLoading } = useBPSettings();

  const isLoading = plLoading || investmentsLoading || financingsLoading || bsLoading || settingsLoading;

  const data = useMemo<FundingPlanData>(() => {
    const years = plData.years.map((y) => y.label);
    const rows: FundingPlanRow[] = [];

    // ═══════════════════════════════════════════════════════════════
    // BESOINS (NEEDS)
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'BESOINS', type: 'header', values: [], isNeed: true });

    // Investments by year
    const investmentsByYear = years.map((_, yearIndex) => {
      const yearStart = plData.years[yearIndex]?.start;
      const yearEnd = plData.years[yearIndex]?.end;
      if (!yearStart || !yearEnd) return 0;

      return investments
        .filter(inv => {
          const purchaseDate = new Date(inv.purchase_date);
          return purchaseDate >= yearStart && purchaseDate <= yearEnd;
        })
        .reduce((sum, inv) => sum + Number(inv.purchase_amount), 0);
    });
    rows.push({ label: 'Investissements', type: 'item', values: investmentsByYear, isNeed: true, indent: 1 });

    // BFR Variation (change in working capital needs)
    const bfrVariation = years.map((_, i) => {
      if (i === 0) return bsData.bfr[0] || 0;
      return (bsData.bfr[i] || 0) - (bsData.bfr[i - 1] || 0);
    });
    rows.push({ label: 'Variation du BFR', type: 'item', values: bfrVariation, isNeed: true, indent: 1 });

    // Loan repayments (principal only, not interest)
    const loanRepayments = years.map((_, yearIndex) => {
      const yearStart = plData.years[yearIndex]?.start;
      const yearEnd = plData.years[yearIndex]?.end;
      if (!yearStart || !yearEnd) return 0;

      // Estimate: monthly payment * 12 - interest
      return financings
        .filter(f => f.financing_type === 'loan')
        .reduce((sum, f) => {
          const startDate = new Date(f.start_date);
          const endDate = f.end_date ? new Date(f.end_date) : null;
          
          // Check if loan is active during this year
          if (startDate > yearEnd) return sum;
          if (endDate && endDate < yearStart) return sum;

          const monthlyPayment = Number(f.monthly_payment) || 0;
          const interestRate = Number(f.interest_rate) || 0;
          const outstandingAtStart = Number(f.amount); // Simplified
          
          // Approximate principal portion (monthly payment minus average interest)
          const annualPayment = monthlyPayment * 12;
          const avgInterest = outstandingAtStart * interestRate;
          return sum + Math.max(0, annualPayment - avgInterest);
        }, 0);
    });
    rows.push({ label: 'Remboursements emprunts', type: 'item', values: loanRepayments, isNeed: true, indent: 1 });

    // Dividends (set to 0 for now, could be configurable)
    const dividends = years.map(() => 0);
    rows.push({ label: 'Dividendes', type: 'item', values: dividends, isNeed: true, indent: 1 });

    const totalNeeds = years.map((_, i) => 
      investmentsByYear[i] + Math.max(0, bfrVariation[i]) + loanRepayments[i] + dividends[i]
    );
    rows.push({ label: 'TOTAL BESOINS', type: 'subtotal', values: totalNeeds, isNeed: true });

    // ═══════════════════════════════════════════════════════════════
    // RESSOURCES (RESOURCES)
    // ═══════════════════════════════════════════════════════════════
    rows.push({ label: 'RESSOURCES', type: 'header', values: [] });

    // CAF = Résultat Net + Dotations aux amortissements
    const caf = years.map((_, i) => {
      const netResult = plData.totals.netResult[i] || 0;
      const depreciation = plData.totals.depreciation[i] || 0;
      return netResult + depreciation;
    });
    rows.push({ label: 'Capacité d\'autofinancement (CAF)', type: 'item', values: caf, indent: 1 });

    // Capital contributions (initial capital in year 1)
    const capitalContributions = years.map((_, i) => {
      if (i === 0) return Number(settings.initial_cash) || 0;
      return 0;
    });
    rows.push({ label: 'Apports en capital', type: 'item', values: capitalContributions, indent: 1 });

    // New loans by year
    const newLoans = years.map((_, yearIndex) => {
      const yearStart = plData.years[yearIndex]?.start;
      const yearEnd = plData.years[yearIndex]?.end;
      if (!yearStart || !yearEnd) return 0;

      return financings
        .filter(f => f.financing_type === 'loan')
        .filter(f => {
          const startDate = new Date(f.start_date);
          return startDate >= yearStart && startDate <= yearEnd;
        })
        .reduce((sum, f) => sum + Number(f.amount), 0);
    });
    rows.push({ label: 'Nouveaux emprunts', type: 'item', values: newLoans, indent: 1 });

    // Current accounts
    const currentAccounts = years.map((_, yearIndex) => {
      const yearStart = plData.years[yearIndex]?.start;
      const yearEnd = plData.years[yearIndex]?.end;
      if (!yearStart || !yearEnd) return 0;

      return financings
        .filter(f => f.financing_type === 'current_account')
        .filter(f => {
          const startDate = new Date(f.start_date);
          return startDate >= yearStart && startDate <= yearEnd;
        })
        .reduce((sum, f) => sum + Number(f.amount), 0);
    });
    rows.push({ label: 'Comptes courants associés', type: 'item', values: currentAccounts, indent: 1 });

    // Add BFR decrease as resource if negative
    const bfrDecrease = years.map((_, i) => Math.max(0, -bfrVariation[i]));
    if (bfrDecrease.some(v => v > 0)) {
      rows.push({ label: 'Diminution du BFR', type: 'item', values: bfrDecrease, indent: 1 });
    }

    const totalResources = years.map((_, i) => 
      caf[i] + capitalContributions[i] + newLoans[i] + currentAccounts[i] + bfrDecrease[i]
    );
    rows.push({ label: 'TOTAL RESSOURCES', type: 'subtotal', values: totalResources });

    // Balance
    const balance = years.map((_, i) => totalResources[i] - totalNeeds[i]);
    rows.push({ label: 'VARIATION DE TRÉSORERIE', type: 'total', values: balance });

    // Cumulative balance
    const cumulativeBalance: number[] = [];
    let cumulative = 0;
    balance.forEach(b => {
      cumulative += b;
      cumulativeBalance.push(cumulative);
    });
    rows.push({ label: 'Trésorerie cumulée', type: 'item', values: cumulativeBalance, indent: 1 });

    return {
      years,
      rows,
      needs: {
        investments: investmentsByYear,
        bfrVariation,
        loanRepayments,
        dividends,
        totalNeeds,
      },
      resources: {
        caf,
        capitalContributions,
        newLoans,
        currentAccounts,
        totalResources,
      },
      balance,
      cumulativeBalance,
    };
  }, [plData, investments, financings, bsData, settings]);

  // Helper: check if funding plan is balanced
  const isBalanced = (): boolean => {
    return data.cumulativeBalance.every(b => b >= 0);
  };

  // Helper: get funding gap (if any)
  const getFundingGap = (): number => {
    const minBalance = Math.min(...data.cumulativeBalance);
    return minBalance < 0 ? Math.abs(minBalance) : 0;
  };

  // Helper: get CAF by year
  const getCAF = (yearIndex: number): number => {
    return data.resources.caf[yearIndex] || 0;
  };

  return {
    data,
    isLoading,
    isBalanced,
    getFundingGap,
    getCAF,
  };
}
