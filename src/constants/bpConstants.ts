// ============================================
// CONSTANTES CENTRALISÉES POUR LE BUSINESS PLAN
// Ces valeurs DOIVENT correspondre aux contraintes CHECK de la base de données
// ============================================

// Catégories de charges fixes
// Contrainte DB: bp_fixed_expenses_category_check
export const FIXED_EXPENSE_CATEGORIES = {
  rent: { label: 'Loyer & Charges locatives', icon: 'Building2' },
  insurance: { label: 'Assurances', icon: 'Shield' },
  software: { label: 'Logiciels & Abonnements', icon: 'Laptop' },
  telecom: { label: 'Téléphonie & Internet', icon: 'Wifi' },
  marketing: { label: 'Marketing & Publicité', icon: 'Megaphone' },
  utilities: { label: 'Électricité, Eau, Gaz', icon: 'Zap' },
  professional_fees: { label: 'Comptable & Juridique', icon: 'Briefcase' },
  banking: { label: 'Frais bancaires', icon: 'CreditCard' },
  travel: { label: 'Déplacements & Transport', icon: 'Car' },
  office: { label: 'Fournitures de bureau', icon: 'Pencil' },
  other: { label: 'Autres charges fixes', icon: 'MoreHorizontal' },
} as const;

export type FixedExpenseCategory = keyof typeof FIXED_EXPENSE_CATEGORIES;

// Modèles de revenus
// Contrainte DB: bp_revenue_streams_model_check
export const REVENUE_MODELS = {
  variable: { label: 'CA variable', description: 'Saisie mensuelle manuelle' },
  subscription: { label: 'Abonnement / SaaS', description: 'Récurrent avec croissance et churn' },
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

// ============================================
// NOMENCLATURE PCG (Plan Comptable Général)
// Conformément au règlement ANC n°2014-03
// ============================================

// Rubriques PCG pour le compte de résultat (classe 6)
export const PCG_EXPENSE_CATEGORIES = {
  purchases: { 
    code: '60', 
    label: 'Achats', 
  },
  external_services: { 
    code: '61', 
    label: 'Services extérieurs', 
  },
  other_external_services: { 
    code: '62', 
    label: 'Autres services extérieurs', 
  },
  taxes: { 
    code: '63', 
    label: 'Impôts, taxes et versements assimilés', 
  },
  personnel: {
    code: '64',
    label: 'Charges de personnel',
  },
  other_operating: { 
    code: '65', 
    label: 'Autres charges de gestion courante', 
  },
  financial: {
    code: '66',
    label: 'Charges financières',
  },
  depreciation: {
    code: '68',
    label: 'Dotations aux amortissements',
  },
} as const;

export type PCGExpenseCategory = keyof typeof PCG_EXPENSE_CATEGORIES;

// Table de correspondance : catégorie interne → rubrique PCG
export const CATEGORY_TO_PCG_MAPPING: Record<string, PCGExpenseCategory> = {
  // Charges fixes actuelles
  rent: 'external_services',           // 61 - Locations
  insurance: 'external_services',       // 61 - Primes d'assurance
  software: 'other_operating',          // 65 - Licences logicielles
  telecom: 'other_external_services',   // 62 - Frais postaux et télécom
  marketing: 'other_external_services', // 62 - Publicité
  utilities: 'external_services',       // 61 - Fournitures (eau, élec, gaz)
  professional_fees: 'other_external_services', // 62 - Honoraires
  banking: 'other_external_services',   // 62 - Services bancaires
  travel: 'other_external_services',    // 62 - Déplacements
  office: 'purchases',                  // 60 - Fournitures de bureau
  other: 'other_operating',             // 65 - Autres
  
  // Charges variables actuelles
  cogs: 'purchases',                    // 60 - Achats de marchandises
  commission: 'other_external_services', // 62 - Commissions
  shipping: 'purchases',                // 60 - Transports sur ventes
  payment_fees: 'other_external_services', // 62 - Services bancaires
};

// Ordre d'affichage des rubriques PCG dans le P&L
export const PCG_ORDER: PCGExpenseCategory[] = [
  'purchases',
  'external_services', 
  'other_external_services',
  'taxes',
  'personnel',
  'other_operating',
  'depreciation',
  'financial',
];

// ============================================
// SOUS-CATÉGORIES PCG (comptes détaillés)
// Pour une saisie optionnelle plus précise
// ============================================

export const PCG_SUBCATEGORIES: Record<FixedExpenseCategory, { code: string; label: string }[]> = {
  utilities: [
    { code: '60611', label: 'Électricité' },
    { code: '60612', label: 'Eau' },
    { code: '60614', label: 'Carburants' },
    { code: '60618', label: 'Chauffage (gaz, fioul)' },
  ],
  rent: [
    { code: '6132', label: 'Locations immobilières' },
    { code: '6135', label: 'Locations mobilières' },
    { code: '6136', label: 'Malis sur emballages' },
  ],
  insurance: [
    { code: '6161', label: 'Assurance multirisques' },
    { code: '6162', label: 'Assurance RC Professionnelle' },
    { code: '6163', label: 'Assurance transport' },
  ],
  software: [
    { code: '6156', label: 'Maintenance logiciels' },
    { code: '6511', label: 'Redevances logiciels (licences)' },
  ],
  telecom: [
    { code: '6261', label: 'Téléphone fixe et mobile' },
    { code: '6262', label: 'Accès Internet' },
    { code: '6263', label: 'Affranchissements' },
  ],
  marketing: [
    { code: '6231', label: 'Annonces et insertions' },
    { code: '6233', label: 'Foires et expositions' },
    { code: '6234', label: 'Cadeaux clients' },
    { code: '6236', label: 'Catalogues et publications' },
  ],
  professional_fees: [
    { code: '6226', label: 'Honoraires comptables' },
    { code: '6227', label: 'Frais d\'actes et contentieux' },
    { code: '6228', label: 'Honoraires divers (avocat, conseil)' },
  ],
  banking: [
    { code: '6271', label: 'Frais sur titres' },
    { code: '6275', label: 'Commissions cartes bancaires' },
    { code: '6278', label: 'Autres frais bancaires' },
  ],
  travel: [
    { code: '6251', label: 'Voyages et déplacements' },
    { code: '6255', label: 'Frais de déménagement' },
    { code: '6256', label: 'Missions (repas, hébergement)' },
    { code: '6257', label: 'Réceptions' },
  ],
  office: [
    { code: '6063', label: 'Petit équipement et outillage' },
    { code: '6064', label: 'Fournitures administratives' },
  ],
  other: [
    { code: '6238', label: 'Publications diverses' },
    { code: '6281', label: 'Cotisations professionnelles' },
  ],
};

// Helper to get PCG subcategory label from code
export function getPCGSubcategoryLabel(category: string, code: string): string | undefined {
  const subcategories = PCG_SUBCATEGORIES[category as FixedExpenseCategory];
  if (!subcategories) return undefined;
  const found = subcategories.find(s => s.code === code);
  return found?.label;
}
