// ============================================================
// computeFundingPlan — pure (parity with src/hooks/useFundingPlan)
// ============================================================
import type { BPModelInput } from './types';
import type { PLData } from '../hooks/useProfitLoss.types';
import type { BalanceSheetData, FundingPlanData, FundingPlanRow } from './types';
import { buildAllLoanSchedules, sumPrincipalInRange, type LoanSchedule } from './schedules/loanSchedule';

export function computeFundingPlan(
  input: BPModelInput, plData: PLData, bsData: BalanceSheetData,
  loanSchedules?: LoanSchedule[]
): FundingPlanData {
  const { settings, investments, financings } = input;
  const schedules = loanSchedules ?? buildAllLoanSchedules(financings);
  const showFinancing = settings.show_financing !== false;
  const years = plData.years.map((_, i) => `Année ${i + 1}`);
  const rows: FundingPlanRow[] = [];

  rows.push({ label: 'BESOINS', type: 'header', values: [], isNeed: true });

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

  const bfrVariation = years.map((_, i) => {
    if (i === 0) return bsData.bfr[0] || 0;
    return (bsData.bfr[i] || 0) - (bsData.bfr[i - 1] || 0);
  });
  rows.push({ label: 'Variation du BFR', type: 'item', values: bfrVariation, isNeed: true, indent: 1 });

  // Lot 2.3: remboursement de capital issu de l'échéancier unique
  const loanRepayments = showFinancing ? years.map((_, yearIndex) => {
    const yearStart = plData.years[yearIndex]?.start;
    const yearEnd = plData.years[yearIndex]?.end;
    if (!yearStart || !yearEnd) return 0;
    return sumPrincipalInRange(schedules, yearStart, yearEnd);
  }) : years.map(() => 0);
  if (showFinancing) {
    rows.push({ label: 'Remboursements emprunts', type: 'item', values: loanRepayments, isNeed: true, indent: 1 });
  }

  const dividends = years.map(() => 0);
  rows.push({ label: 'Dividendes', type: 'item', values: dividends, isNeed: true, indent: 1 });

  const totalNeeds = years.map((_, i) =>
    investmentsByYear[i] + Math.max(0, bfrVariation[i]) + loanRepayments[i] + dividends[i]
  );
  rows.push({ label: 'TOTAL BESOINS', type: 'subtotal', values: totalNeeds, isNeed: true });

  rows.push({ label: 'RESSOURCES', type: 'header', values: [] });

  const caf = years.map((_, i) => {
    const netResult = plData.totals.netResult[i] || 0;
    const depreciation = plData.totals.depreciation[i] || 0;
    return netResult + depreciation;
  });
  rows.push({ label: "Capacité d'autofinancement (CAF)", type: 'item', values: caf, indent: 1 });

  const capitalContributions = years.map((_, i) => i === 0 ? Number(settings.initial_cash) || 0 : 0);
  rows.push({ label: 'Apports en capital', type: 'item', values: capitalContributions, indent: 1 });

  const newLoans = showFinancing ? years.map((_, yearIndex) => {
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
  }) : years.map(() => 0);
  if (showFinancing) {
    rows.push({ label: 'Nouveaux emprunts', type: 'item', values: newLoans, indent: 1 });
  }

  const currentAccounts = showFinancing ? years.map((_, yearIndex) => {
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
  }) : years.map(() => 0);
  if (showFinancing) {
    rows.push({ label: 'Comptes courants associés', type: 'item', values: currentAccounts, indent: 1 });
  }

  const bfrDecrease = years.map((_, i) => Math.max(0, -bfrVariation[i]));
  if (bfrDecrease.some(v => v > 0)) {
    rows.push({ label: 'Diminution du BFR', type: 'item', values: bfrDecrease, indent: 1 });
  }

  const totalResources = years.map((_, i) =>
    caf[i] + capitalContributions[i] + newLoans[i] + currentAccounts[i] + bfrDecrease[i]
  );
  rows.push({ label: 'TOTAL RESSOURCES', type: 'subtotal', values: totalResources });

  const balance = years.map((_, i) => totalResources[i] - totalNeeds[i]);
  rows.push({ label: 'VARIATION DE TRÉSORERIE', type: 'total', values: balance });

  const cumulativeBalance: number[] = [];
  let cumulative = 0;
  balance.forEach(b => { cumulative += b; cumulativeBalance.push(cumulative); });
  rows.push({ label: 'Trésorerie cumulée', type: 'item', values: cumulativeBalance, indent: 1 });

  return {
    years, rows,
    needs: { investments: investmentsByYear, bfrVariation, loanRepayments, dividends, totalNeeds },
    resources: { caf, capitalContributions, newLoans, currentAccounts, totalResources },
    balance, cumulativeBalance,
  };
}
