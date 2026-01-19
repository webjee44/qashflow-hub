// ============================================
// useBPCashFlow Hook - Refonte complète
// Calcul précis des encaissements/décaissements
// ============================================

import { useMemo, useCallback } from 'react';
import { useProfitLoss, PLData } from './useProfitLoss';
import { useBPSettings } from './useBPSettings';
import { useFinancings } from './useFinancings';
import { useInvestments } from './useInvestments';
import { useDirectors } from './useDirectors';
import { parseISO, startOfMonth, format, isSameMonth } from 'date-fns';

// ============================================
// TYPES
// ============================================

export interface CashFlowDetailedInflows {
  revenue: number[];           // CA encaissé (décalé par délai client)
  loanDisbursements: number[]; // Déblocage emprunts
  capitalContributions: number[]; // Apports en capital
  grants: number[];            // Subventions
  currentAccountContributions: number[]; // Apports en compte courant
  total: number[];
}

export interface CashFlowDetailedOutflows {
  fixedExpenses: number[];     // Charges fixes (décalées par délai fournisseur)
  variableExpenses: number[];  // Charges variables / COGS
  personnel: number[];         // Salaires bruts + charges
  directors: number[];         // Rémunération dirigeants + charges
  payrollTaxes: number[];      // Taxes sur salaires auto
  investments: number[];       // Décaissements investissements
  loanPayments: number[];      // Remboursements emprunts (capital + intérêts)
  leasePayments: number[];     // Loyers crédit-bail
  vatPayments: number[];       // TVA à reverser
  taxPayments: number[];       // Acomptes IS
  total: number[];
}

export interface CashFlowMonthData {
  month: Date;
  monthLabel: string;
  inflows: {
    revenue: number;
    loanDisbursements: number;
    capitalContributions: number;
    grants: number;
    currentAccountContributions: number;
    total: number;
  };
  outflows: {
    fixedExpenses: number;
    variableExpenses: number;
    personnel: number;
    directors: number;
    payrollTaxes: number;
    investments: number;
    loanPayments: number;
    leasePayments: number;
    vatPayments: number;
    taxPayments: number;
    total: number;
  };
  netFlow: number;
  balance: number;
}

export interface CashFlowData {
  months: Date[];
  monthlyData: CashFlowMonthData[];
  inflows: CashFlowDetailedInflows;
  outflows: CashFlowDetailedOutflows;
  netFlow: number[];
  balance: number[];
  // Stats
  initialBalance: number;
  finalBalance: number;
  minBalance: number;
  maxBalance: number;
  monthsWithNegativeBalance: number;
  lowestMonth: { month: Date; balance: number; index: number } | null;
  highestMonth: { month: Date; balance: number; index: number } | null;
  // Totaux
  totalInflows: number;
  totalOutflows: number;
}

// ============================================
// HOOK
// ============================================

export function useBPCashFlow() {
  const { data: plData, isLoading: plLoading } = useProfitLoss();
  const { settings, isLoading: settingsLoading } = useBPSettings();
  const { 
    financings,
    getLoanDisbursements, 
    getMonthlyLoanPayments, 
    getMonthlyLeasePayments,
    isLoading: financingsLoading 
  } = useFinancings();
  const { investments, isLoading: investmentsLoading } = useInvestments();
  const { directors, getBreakdownForMonth: getDirectorsBreakdown, isLoading: directorsLoading } = useDirectors();

  const isLoading = plLoading || settingsLoading || financingsLoading || investmentsLoading || directorsLoading;
  const showFinancing = settings.show_financing !== false;

  // Helper: calculer le délai en mois (arrondi à 0.5 près)
  const getDaysToMonths = useCallback((days: number): number => {
    if (days <= 15) return 0;
    if (days <= 45) return 1;
    if (days <= 75) return 2;
    return Math.round(days / 30);
  }, []);

  // Helper: obtenir les investissements cash-out pour un mois
  const getInvestmentCashOutForMonth = useCallback((month: Date): number => {
    return investments.reduce((sum, inv) => {
      const purchaseDate = parseISO(inv.purchase_date);
      if (isSameMonth(startOfMonth(month), startOfMonth(purchaseDate))) {
        return sum + (Number(inv.purchase_amount) || 0);
      }
      return sum;
    }, 0);
  }, [investments]);

  // Helper: obtenir les apports en capital pour un mois
  // Les apports en capital sont généralement dans les financings de type current_account ou loan marqués comme capital
  const getCapitalContributionsForMonth = useCallback((month: Date): number => {
    if (!showFinancing) return 0;
    return financings
      .filter(f => {
        // Filtre basé sur le nom contenant "capital" et qui n'est pas un prêt standard
        const nameLC = f.name?.toLowerCase() || '';
        return nameLC.includes('capital') || nameLC.includes('apport');
      })
      .reduce((sum, f) => {
        const startDate = parseISO(f.start_date);
        if (isSameMonth(startOfMonth(month), startOfMonth(startDate))) {
          return sum + Number(f.amount);
        }
        return sum;
      }, 0);
  }, [financings, showFinancing]);

  // Helper: obtenir les apports en compte courant pour un mois
  const getCurrentAccountContributionsForMonth = useCallback((month: Date): number => {
    if (!showFinancing) return 0;
    return financings
      .filter(f => f.financing_type === 'current_account')
      .reduce((sum, f) => {
        const startDate = parseISO(f.start_date);
        if (isSameMonth(startOfMonth(month), startOfMonth(startDate))) {
          return sum + Number(f.amount);
        }
        return sum;
      }, 0);
  }, [financings, showFinancing]);

  // Helper: obtenir les subventions pour un mois
  // Les subventions sont identifiées par le nom
  const getGrantsForMonth = useCallback((month: Date): number => {
    if (!showFinancing) return 0;
    return financings
      .filter(f => {
        const nameLC = f.name?.toLowerCase() || '';
        return nameLC.includes('subvention') || nameLC.includes('aide') || nameLC.includes('grant');
      })
      .reduce((sum, f) => {
        const startDate = parseISO(f.start_date);
        if (isSameMonth(startOfMonth(month), startOfMonth(startDate))) {
          return sum + Number(f.amount);
        }
        return sum;
      }, 0);
  }, [financings, showFinancing]);

  const data = useMemo<CashFlowData>(() => {
    // Flatten all months from all years
    const months = plData.years.flatMap(year => year.months);
    const customerDelay = getDaysToMonths(settings.customer_payment_delay || 30);
    const supplierDelay = getDaysToMonths(settings.supplier_payment_delay || 30);
    const initialCash = Number(settings.initial_cash) || 0;

    // ============================================
    // CALCUL DES VALEURS MENSUELLES PRÉCISES
    // ============================================

    // Construire un index mois -> données du P&L
    const monthlyPLData: {
      revenue: number;
      fixedExpenses: number;
      variableExpenses: number;
      personnelCosts: number;
      directorsCosts: number;
      payrollTaxes: number;
      vatBalance: number;
      corporateTax: number;
    }[] = [];

    plData.years.forEach((year, yearIndex) => {
      const monthCount = year.months.length;
      const yearRevenue = plData.totals.revenue[yearIndex] || 0;
      const yearFixed = plData.totals.fixedExpenses[yearIndex] || 0;
      const yearVariable = plData.totals.variableExpenses[yearIndex] || 0;
      const yearPersonnel = plData.totals.personnelCosts[yearIndex] || 0;
      const yearDirectors = plData.totals.directorsCosts[yearIndex] || 0;
      const yearPayrollTaxes = plData.totals.payrollTaxes[yearIndex] || 0;
      const yearVATBalance = plData.tva.balance[yearIndex] || 0;
      const yearCorporateTax = plData.totals.corporateTax[yearIndex] || 0;

      // Distribute yearly values evenly across months
      for (let i = 0; i < monthCount; i++) {
        monthlyPLData.push({
          revenue: yearRevenue / monthCount,
          fixedExpenses: yearFixed / monthCount,
          variableExpenses: yearVariable / monthCount,
          personnelCosts: yearPersonnel / monthCount,
          directorsCosts: yearDirectors / monthCount,
          payrollTaxes: yearPayrollTaxes / monthCount,
          vatBalance: yearVATBalance / monthCount, // Simplifié - en réalité trimestriel
          corporateTax: yearCorporateTax / 12, // Réparti sur l'année (acomptes)
        });
      }
    });

    // ============================================
    // ENCAISSEMENTS (INFLOWS)
    // ============================================

    const inflowsRevenue: number[] = [];
    const inflowsLoans: number[] = [];
    const inflowsCapital: number[] = [];
    const inflowsGrants: number[] = [];
    const inflowsCurrentAccount: number[] = [];

    months.forEach((month, i) => {
      // Revenue décalé par délai client
      const revenueSourceIndex = i - customerDelay;
      const revenue = revenueSourceIndex >= 0 && revenueSourceIndex < monthlyPLData.length
        ? monthlyPLData[revenueSourceIndex].revenue
        : 0;
      inflowsRevenue.push(revenue);

      // Financements (non décalés - entrée immédiate)
      inflowsLoans.push(showFinancing ? getLoanDisbursements(month) : 0);
      inflowsCapital.push(getCapitalContributionsForMonth(month));
      inflowsGrants.push(getGrantsForMonth(month));
      inflowsCurrentAccount.push(getCurrentAccountContributionsForMonth(month));
    });

    const totalInflows = months.map((_, i) => 
      inflowsRevenue[i] + inflowsLoans[i] + inflowsCapital[i] + inflowsGrants[i] + inflowsCurrentAccount[i]
    );

    // ============================================
    // DÉCAISSEMENTS (OUTFLOWS)
    // ============================================

    const outflowsFixed: number[] = [];
    const outflowsVariable: number[] = [];
    const outflowsPersonnel: number[] = [];
    const outflowsDirectors: number[] = [];
    const outflowsPayrollTaxes: number[] = [];
    const outflowsInvestments: number[] = [];
    const outflowsLoanPayments: number[] = [];
    const outflowsLeasePayments: number[] = [];
    const outflowsVAT: number[] = [];
    const outflowsTax: number[] = [];

    months.forEach((month, i) => {
      // Charges fixes décalées par délai fournisseur
      const fixedSourceIndex = i - supplierDelay;
      const fixedExp = fixedSourceIndex >= 0 && fixedSourceIndex < monthlyPLData.length
        ? monthlyPLData[fixedSourceIndex].fixedExpenses
        : 0;
      outflowsFixed.push(fixedExp);

      // Charges variables décalées par délai fournisseur
      const variableExp = fixedSourceIndex >= 0 && fixedSourceIndex < monthlyPLData.length
        ? monthlyPLData[fixedSourceIndex].variableExpenses
        : 0;
      outflowsVariable.push(variableExp);

      // Personnel (payé le mois même, décalé de 1 mois pour les charges)
      const personnelSourceIndex = i - 1; // Salaires payés M+1
      const personnel = personnelSourceIndex >= 0 && personnelSourceIndex < monthlyPLData.length
        ? monthlyPLData[personnelSourceIndex].personnelCosts
        : 0;
      outflowsPersonnel.push(personnel);

      // Dirigeants (payé le mois même)
      const directorsData = getDirectorsBreakdown(month);
      outflowsDirectors.push(directorsData.total);

      // Taxes sur salaires (payées trimestriellement - simplifié mensuellement)
      const payrollTaxes = i > 0 && monthlyPLData[i] ? monthlyPLData[i].payrollTaxes : 0;
      outflowsPayrollTaxes.push(payrollTaxes);

      // Investissements (cash-out immédiat à la date d'achat)
      outflowsInvestments.push(getInvestmentCashOutForMonth(month));

      // Remboursements emprunts (non décalés - contractuel)
      outflowsLoanPayments.push(showFinancing ? getMonthlyLoanPayments(month) : 0);

      // Loyers crédit-bail (non décalés - contractuel)
      outflowsLeasePayments.push(showFinancing ? getMonthlyLeasePayments(month) : 0);

      // TVA à reverser (simplifié - mensuel)
      const vatBalance = monthlyPLData[i]?.vatBalance || 0;
      outflowsVAT.push(vatBalance > 0 ? vatBalance : 0);

      // Impôt sur les sociétés (acomptes trimestriels - simplifié mensuel)
      const taxPayment = monthlyPLData[i]?.corporateTax || 0;
      outflowsTax.push(taxPayment > 0 ? taxPayment : 0);
    });

    const totalOutflows = months.map((_, i) => 
      outflowsFixed[i] + outflowsVariable[i] + outflowsPersonnel[i] + 
      outflowsDirectors[i] + outflowsPayrollTaxes[i] + outflowsInvestments[i] +
      outflowsLoanPayments[i] + outflowsLeasePayments[i] + 
      outflowsVAT[i] + outflowsTax[i]
    );

    // ============================================
    // FLUX NET ET SOLDE CUMULÉ
    // ============================================

    const netFlow = months.map((_, i) => totalInflows[i] - totalOutflows[i]);

    const balance: number[] = [];
    let runningBalance = initialCash;
    netFlow.forEach(nf => {
      runningBalance += nf;
      balance.push(runningBalance);
    });

    // ============================================
    // STATS
    // ============================================

    const minBalance = balance.length > 0 ? Math.min(...balance) : 0;
    const maxBalance = balance.length > 0 ? Math.max(...balance) : 0;
    const finalBalance = balance.length > 0 ? balance[balance.length - 1] : initialCash;
    const monthsWithNegativeBalance = balance.filter(b => b < 0).length;

    // Trouver le mois le plus bas
    let lowestMonth: CashFlowData['lowestMonth'] = null;
    if (balance.length > 0) {
      const minIdx = balance.indexOf(minBalance);
      lowestMonth = {
        month: months[minIdx],
        balance: minBalance,
        index: minIdx,
      };
    }

    // Trouver le mois le plus haut
    let highestMonth: CashFlowData['highestMonth'] = null;
    if (balance.length > 0) {
      const maxIdx = balance.indexOf(maxBalance);
      highestMonth = {
        month: months[maxIdx],
        balance: maxBalance,
        index: maxIdx,
      };
    }

    // ============================================
    // DONNÉES MENSUELLES DÉTAILLÉES
    // ============================================

    const monthlyData: CashFlowMonthData[] = months.map((month, i) => ({
      month,
      monthLabel: format(month, 'MMM yyyy'),
      inflows: {
        revenue: inflowsRevenue[i],
        loanDisbursements: inflowsLoans[i],
        capitalContributions: inflowsCapital[i],
        grants: inflowsGrants[i],
        currentAccountContributions: inflowsCurrentAccount[i],
        total: totalInflows[i],
      },
      outflows: {
        fixedExpenses: outflowsFixed[i],
        variableExpenses: outflowsVariable[i],
        personnel: outflowsPersonnel[i],
        directors: outflowsDirectors[i],
        payrollTaxes: outflowsPayrollTaxes[i],
        investments: outflowsInvestments[i],
        loanPayments: outflowsLoanPayments[i],
        leasePayments: outflowsLeasePayments[i],
        vatPayments: outflowsVAT[i],
        taxPayments: outflowsTax[i],
        total: totalOutflows[i],
      },
      netFlow: netFlow[i],
      balance: balance[i],
    }));

    return {
      months,
      monthlyData,
      inflows: {
        revenue: inflowsRevenue,
        loanDisbursements: inflowsLoans,
        capitalContributions: inflowsCapital,
        grants: inflowsGrants,
        currentAccountContributions: inflowsCurrentAccount,
        total: totalInflows,
      },
      outflows: {
        fixedExpenses: outflowsFixed,
        variableExpenses: outflowsVariable,
        personnel: outflowsPersonnel,
        directors: outflowsDirectors,
        payrollTaxes: outflowsPayrollTaxes,
        investments: outflowsInvestments,
        loanPayments: outflowsLoanPayments,
        leasePayments: outflowsLeasePayments,
        vatPayments: outflowsVAT,
        taxPayments: outflowsTax,
        total: totalOutflows,
      },
      netFlow,
      balance,
      initialBalance: initialCash,
      finalBalance,
      minBalance,
      maxBalance,
      monthsWithNegativeBalance,
      lowestMonth,
      highestMonth,
      totalInflows: totalInflows.reduce((a, b) => a + b, 0),
      totalOutflows: totalOutflows.reduce((a, b) => a + b, 0),
    };
  }, [
    plData, settings, showFinancing,
    getLoanDisbursements, getMonthlyLoanPayments, getMonthlyLeasePayments,
    getInvestmentCashOutForMonth, getCapitalContributionsForMonth,
    getGrantsForMonth, getCurrentAccountContributionsForMonth,
    getDirectorsBreakdown, getDaysToMonths
  ]);

  // Helper: check if cash flow is healthy
  const isHealthy = useCallback((): boolean => {
    return data.minBalance >= 0;
  }, [data.minBalance]);

  // Helper: get minimum required initial cash to stay positive
  const getMinimumInitialCash = useCallback((): number => {
    if (data.minBalance >= 0) return 0;
    return Math.abs(data.minBalance) + 1000; // Marge de sécurité de 1000€
  }, [data.minBalance]);

  return {
    data,
    isLoading,
    isHealthy,
    getMinimumInitialCash,
  };
}
