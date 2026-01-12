// Mock data for the treasury management app

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  isReconciled: boolean;
  source: string;
  aiConfidence?: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'income' | 'expense';
}

export interface Forecast {
  month: string;
  expectedIncome: number;
  expectedExpense: number;
  actualIncome?: number;
  actualExpense?: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  category: string;
  isActive: boolean;
}

export const categories: Category[] = [
  { id: '1', name: 'Ventes', color: 'hsl(142, 76%, 36%)', icon: 'TrendingUp', type: 'income' },
  { id: '2', name: 'Prestations', color: 'hsl(200, 80%, 50%)', icon: 'Briefcase', type: 'income' },
  { id: '3', name: 'Remboursements', color: 'hsl(173, 80%, 40%)', icon: 'RotateCcw', type: 'income' },
  { id: '4', name: 'Salaires', color: 'hsl(0, 84%, 60%)', icon: 'Users', type: 'expense' },
  { id: '5', name: 'Loyer', color: 'hsl(280, 60%, 50%)', icon: 'Building', type: 'expense' },
  { id: '6', name: 'Fournisseurs', color: 'hsl(38, 92%, 50%)', icon: 'Package', type: 'expense' },
  { id: '7', name: 'Marketing', color: 'hsl(320, 70%, 50%)', icon: 'Megaphone', type: 'expense' },
  { id: '8', name: 'Logiciels', color: 'hsl(221, 83%, 53%)', icon: 'Laptop', type: 'expense' },
];

export const transactions: Transaction[] = [
  { id: '1', date: '2026-01-12', description: 'Paiement client - ACME Corp', amount: 15000, category: 'Ventes', type: 'income', isReconciled: true, source: 'Pennylane', aiConfidence: 0.98 },
  { id: '2', date: '2026-01-11', description: 'Abonnement AWS', amount: -450, category: 'Logiciels', type: 'expense', isReconciled: true, source: 'Pennylane', aiConfidence: 0.95 },
  { id: '3', date: '2026-01-10', description: 'Virement salaires janvier', amount: -28000, category: 'Salaires', type: 'expense', isReconciled: true, source: 'Pennylane', aiConfidence: 0.99 },
  { id: '4', date: '2026-01-09', description: 'Facture client - TechStart', amount: 8500, category: 'Prestations', type: 'income', isReconciled: false, source: 'Pennylane', aiConfidence: 0.87 },
  { id: '5', date: '2026-01-08', description: 'Loyer bureaux janvier', amount: -3200, category: 'Loyer', type: 'expense', isReconciled: true, source: 'Pennylane', aiConfidence: 0.99 },
  { id: '6', date: '2026-01-07', description: 'Google Ads - Campagne Q1', amount: -1200, category: 'Marketing', type: 'expense', isReconciled: true, source: 'Pennylane', aiConfidence: 0.92 },
  { id: '7', date: '2026-01-06', description: 'Paiement fournisseur matériel', amount: -5600, category: 'Fournisseurs', type: 'expense', isReconciled: false, source: 'Pennylane', aiConfidence: 0.88 },
  { id: '8', date: '2026-01-05', description: 'Client - Startup Vision', amount: 22000, category: 'Ventes', type: 'income', isReconciled: true, source: 'Pennylane', aiConfidence: 0.96 },
  { id: '9', date: '2026-01-04', description: 'Remboursement TVA', amount: 4200, category: 'Remboursements', type: 'income', isReconciled: true, source: 'Pennylane', aiConfidence: 0.99 },
  { id: '10', date: '2026-01-03', description: 'Abonnement Slack', amount: -89, category: 'Logiciels', type: 'expense', isReconciled: true, source: 'Pennylane', aiConfidence: 0.97 },
];

export const forecasts: Forecast[] = [
  { month: 'Jan 2026', expectedIncome: 55000, expectedExpense: 42000, actualIncome: 49700, actualExpense: 38539 },
  { month: 'Fév 2026', expectedIncome: 48000, expectedExpense: 40000 },
  { month: 'Mar 2026', expectedIncome: 62000, expectedExpense: 45000 },
  { month: 'Avr 2026', expectedIncome: 58000, expectedExpense: 43000 },
  { month: 'Mai 2026', expectedIncome: 65000, expectedExpense: 44000 },
  { month: 'Jun 2026', expectedIncome: 70000, expectedExpense: 46000 },
  { month: 'Jul 2026', expectedIncome: 55000, expectedExpense: 42000 },
  { month: 'Aoû 2026', expectedIncome: 45000, expectedExpense: 38000 },
  { month: 'Sep 2026', expectedIncome: 68000, expectedExpense: 47000 },
  { month: 'Oct 2026', expectedIncome: 72000, expectedExpense: 48000 },
  { month: 'Nov 2026', expectedIncome: 75000, expectedExpense: 50000 },
  { month: 'Déc 2026', expectedIncome: 80000, expectedExpense: 52000 },
];

export const automationRules: AutomationRule[] = [
  { id: '1', name: 'Salaires mensuels', condition: 'Description contient "salaire"', action: 'Catégoriser', category: 'Salaires', isActive: true },
  { id: '2', name: 'Abonnements SaaS', condition: 'Description contient "abonnement"', action: 'Catégoriser', category: 'Logiciels', isActive: true },
  { id: '3', name: 'Loyer bureaux', condition: 'Description contient "loyer"', action: 'Catégoriser', category: 'Loyer', isActive: true },
  { id: '4', name: 'Paiements clients', condition: 'Montant > 5000 et type = crédit', action: 'Catégoriser', category: 'Ventes', isActive: false },
];

export const getBalanceData = () => {
  const currentBalance = 127450;
  const data = forecasts.map((f, index) => {
    const balance = currentBalance + forecasts.slice(0, index + 1).reduce((acc, curr) => {
      const income = curr.actualIncome ?? curr.expectedIncome;
      const expense = curr.actualExpense ?? curr.expectedExpense;
      return acc + income - expense;
    }, 0);
    return {
      month: f.month,
      balance,
      income: f.actualIncome ?? f.expectedIncome,
      expense: f.actualExpense ?? f.expectedExpense,
      isProjection: !f.actualIncome,
    };
  });
  return data;
};
