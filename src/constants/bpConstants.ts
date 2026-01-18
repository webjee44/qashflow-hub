// ============================================
// CONSTANTES CENTRALISÉES POUR LE BUSINESS PLAN
// Ces valeurs DOIVENT correspondre aux contraintes CHECK de la base de données
// ============================================

// Catégories de charges fixes
// Contrainte DB: bp_fixed_expenses_category_check
export const FIXED_EXPENSE_CATEGORIES = {
  rent: { label: 'Loyer', icon: 'Building2' },
  insurance: { label: 'Assurances', icon: 'Shield' },
  software: { label: 'Logiciels & Abonnements', icon: 'Laptop' },
  marketing: { label: 'Marketing', icon: 'Megaphone' },
  utilities: { label: 'Charges & Fluides', icon: 'Zap' },
  professional_fees: { label: 'Honoraires', icon: 'Briefcase' },
  other: { label: 'Autres', icon: 'MoreHorizontal' },
} as const;

export type FixedExpenseCategory = keyof typeof FIXED_EXPENSE_CATEGORIES;

// Modèles de revenus
// Contrainte DB: bp_revenue_streams_model_check
export const REVENUE_MODELS = {
  fixed: { label: 'Montant fixe', description: 'CA mensuel fixe' },
  units: { label: 'À l\'unité', description: 'Prix x Quantité' },
  growth: { label: 'Croissance', description: 'Croissance mensuelle' },
  subscription: { label: 'Abonnement', description: 'Récurrent avec churn' },
} as const;

export type RevenueModel = keyof typeof REVENUE_MODELS;

// Fréquences de paiement
export const PAYMENT_FREQUENCIES = {
  monthly: { label: 'Mensuel', multiplier: 1 },
  quarterly: { label: 'Trimestriel', multiplier: 3 },
  biannual: { label: 'Semestriel', multiplier: 6 },
  annual: { label: 'Annuel', multiplier: 12 },
} as const;

export type PaymentFrequency = keyof typeof PAYMENT_FREQUENCIES;

// Mois de paiement par défaut selon la fréquence
export const DEFAULT_PAYMENT_MONTHS: Record<PaymentFrequency, number[]> = {
  monthly: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  quarterly: [1, 4, 7, 10],
  biannual: [1, 7],
  annual: [1],
};

// Types de travailleurs
// Contrainte DB: bp_personnel_worker_type_check
export const WORKER_TYPES = {
  employee: { label: 'Salarié', icon: 'User' },
  freelance: { label: 'Freelance / Prestataire', icon: 'Briefcase' },
  intern: { label: 'Stagiaire', icon: 'GraduationCap' },
} as const;

export type WorkerType = keyof typeof WORKER_TYPES;

// Types de contrat
// Contrainte DB: bp_personnel_contract_type_check
export const CONTRACT_TYPES = {
  cdi: { label: 'CDI' },
  cdd: { label: 'CDD' },
  interim: { label: 'Intérim' },
  apprentice: { label: 'Apprentissage' },
  internship: { label: 'Stage' },
} as const;

export type ContractType = keyof typeof CONTRACT_TYPES;

// Types de financement
// Contrainte DB: bp_financings_financing_type_check
export const FINANCING_TYPES = {
  equity: { label: 'Apport en capital', icon: 'Landmark' },
  loan: { label: 'Emprunt bancaire', icon: 'Building2' },
  grant: { label: 'Subvention', icon: 'Gift' },
  leasing: { label: 'Crédit-bail', icon: 'Car' },
  current_account: { label: 'Compte courant associé', icon: 'Wallet' },
  other: { label: 'Autre', icon: 'MoreHorizontal' },
} as const;

export type FinancingType = keyof typeof FINANCING_TYPES;

// Catégories d'investissement
// Contrainte DB: bp_investments_category_check
export const INVESTMENT_CATEGORIES = {
  equipment: { label: 'Matériel & Équipement', icon: 'Wrench' },
  vehicle: { label: 'Véhicule', icon: 'Car' },
  furniture: { label: 'Mobilier', icon: 'Armchair' },
  it: { label: 'Informatique', icon: 'Monitor' },
  intangible: { label: 'Incorporel (brevets, licences)', icon: 'FileText' },
  renovation: { label: 'Travaux & Aménagements', icon: 'Hammer' },
  other: { label: 'Autre', icon: 'MoreHorizontal' },
} as const;

export type InvestmentCategory = keyof typeof INVESTMENT_CATEGORIES;

// Catégories de charges variables
export const VARIABLE_EXPENSE_CATEGORIES = {
  cogs: { label: 'Coût des ventes', icon: 'Package' },
  commission: { label: 'Commissions', icon: 'Percent' },
  shipping: { label: 'Livraison', icon: 'Truck' },
  payment_fees: { label: 'Frais de paiement', icon: 'CreditCard' },
  other: { label: 'Autres', icon: 'MoreHorizontal' },
} as const;

export type VariableExpenseCategory = keyof typeof VARIABLE_EXPENSE_CATEGORIES;

// Types de calcul des charges variables
export const VARIABLE_CALCULATION_TYPES = {
  percentage: { label: '% du CA', description: 'Pourcentage du chiffre d\'affaires' },
  per_unit: { label: 'Par unité', description: 'Coût par unité vendue' },
} as const;

export type VariableCalculationType = keyof typeof VARIABLE_CALCULATION_TYPES;
