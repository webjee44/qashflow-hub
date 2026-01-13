// Taux URSSAF 2026 officiels - France
export const URSSAF_RATES_2026 = {
  // Cotisations patronales (taux employeur)
  employer: {
    maladie: { full: 0.13, reduced: 0.07 },           // 13% ou 7% (salaire ≤ 2.5 SMIC)
    csa: 0.003,                                        // Contribution solidarité autonomie
    vieillesse_deplafonnee: 0.0211,                    // 2.11%
    vieillesse_plafonnee: 0.0855,                      // 8.55% (jusqu'au PASS)
    allocations_familiales: { full: 0.0525, reduced: 0.0345 }, // 5.25% ou 3.45%
    chomage: 0.0405,                                   // 4.05%
    ags: 0.0015,                                       // 0.15%
    fnal: { small: 0.001, large: 0.005 },             // 0.1% (<50) ou 0.5% (≥50)
    formation: { small: 0.0055, large: 0.01 },        // 0.55% (<11) ou 1% (≥11)
    apprentissage: 0.0068,                             // 0.68%
    at_mp: 0.02,                                       // ~2% moyenne (variable selon activité)
    retraite_complementaire: {
      tranche1: { cadre: 0.0472, nonCadre: 0.0472 },   // Agirc-Arrco T1
      tranche2: { cadre: 0.1295, nonCadre: 0 },        // Agirc-Arrco T2 (cadres)
    },
    cet: 0.0014,                                       // Contribution d'équilibre technique
    prevoyance_cadre: 0.015,                           // Prévoyance obligatoire cadres (1.5%)
  },

  // Plafonds 2026
  plafonds: {
    pass_annuel: 48020,           // Plafond Annuel SS
    pass_mensuel: 4002,           // Plafond Mensuel SS
    smic_mensuel_brut: 1801.80,   // SMIC mensuel brut 2026
    smic_horaire: 11.88,
  },

  // Seuils pour réductions
  seuils: {
    maladie_reduit: 2.5,          // × SMIC pour taux réduit maladie
    af_reduit: 3.5,               // × SMIC pour taux réduit alloc fam
  },
};

// Taux TVA France
export const TVA_RATES_FR = {
  standard: 0.20,       // 20%
  intermediaire: 0.10,  // 10%
  reduit: 0.055,        // 5.5%
  super_reduit: 0.021,  // 2.1%
};

// Tranches IS France 2026
export const IS_RATES_FR = {
  taux_reduit_pme: 0.15,     // 15% jusqu'à 42 500€
  taux_normal: 0.25,         // 25%
  plafond_taux_reduit: 42500,
};

// Coefficients amortissement dégressif fiscal
export const DEPRECIATION_COEFFICIENTS = {
  3: 1.25,  // 3-4 ans
  5: 1.75,  // 5-6 ans
  7: 2.25,  // 7+ ans
};

// Labels et catégories
export const CONTRACT_TYPES = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'apprentice', label: 'Apprenti' },
  { value: 'intern', label: 'Stagiaire' },
] as const;

export const COMPANY_SIZES = [
  { value: 'small', label: 'Moins de 11 salariés', threshold: 11 },
  { value: 'medium', label: '11 à 49 salariés', threshold: 50 },
  { value: 'large', label: '50 salariés et plus', threshold: Infinity },
] as const;

export const DIRECTOR_STATUSES = [
  { value: 'assimile_salarie', label: 'Assimilé salarié (SAS, SASU)', chargesRate: 0.82 },
  { value: 'tns', label: 'TNS (SARL gérant majoritaire, EI)', chargesRate: 0.45 },
] as const;

export const INVESTMENT_CATEGORIES = [
  { value: 'equipment', label: 'Matériel et outillage', defaultYears: 5 },
  { value: 'vehicle', label: 'Véhicules', defaultYears: 5 },
  { value: 'furniture', label: 'Mobilier', defaultYears: 10 },
  { value: 'software', label: 'Logiciels', defaultYears: 3 },
  { value: 'computer', label: 'Matériel informatique', defaultYears: 3 },
  { value: 'building', label: 'Constructions', defaultYears: 20 },
  { value: 'other', label: 'Autres immobilisations', defaultYears: 5 },
] as const;

// Calcul des cotisations patronales détaillées
export interface DetailedCharges {
  maladie: number;
  csa: number;
  vieillesseDeplafonnee: number;
  vieillessePlafonnee: number;
  allocationsFamiliales: number;
  chomage: number;
  ags: number;
  fnal: number;
  formation: number;
  apprentissage: number;
  atMp: number;
  retraiteComplementaireT1: number;
  retraiteComplementaireT2: number;
  cet: number;
  prevoyanceCadre: number;
  total: number;
}

export function calculateDetailedCharges(
  grossSalary: number,
  isExecutive: boolean,
  companySize: 'small' | 'medium' | 'large',
  contractType: string = 'cdi'
): DetailedCharges {
  const rates = URSSAF_RATES_2026;
  const pass = rates.plafonds.pass_mensuel;
  const smic = rates.plafonds.smic_mensuel_brut;
  
  // Déterminer les taux réduits
  const salaryRatio = grossSalary / smic;
  const useMaladieReduit = salaryRatio <= rates.seuils.maladie_reduit;
  const useAFReduit = salaryRatio <= rates.seuils.af_reduit;
  const isLarge = companySize === 'large';
  const isSmall = companySize === 'small';
  
  // Tranches pour retraite complémentaire
  const tranche1 = Math.min(grossSalary, pass);
  const tranche2 = Math.max(0, Math.min(grossSalary, pass * 8) - pass);
  
  // Calculer chaque cotisation
  const charges: DetailedCharges = {
    maladie: grossSalary * (useMaladieReduit ? rates.employer.maladie.reduced : rates.employer.maladie.full),
    csa: grossSalary * rates.employer.csa,
    vieillesseDeplafonnee: grossSalary * rates.employer.vieillesse_deplafonnee,
    vieillessePlafonnee: tranche1 * rates.employer.vieillesse_plafonnee,
    allocationsFamiliales: grossSalary * (useAFReduit ? rates.employer.allocations_familiales.reduced : rates.employer.allocations_familiales.full),
    chomage: contractType === 'intern' ? 0 : grossSalary * rates.employer.chomage,
    ags: contractType === 'intern' ? 0 : grossSalary * rates.employer.ags,
    fnal: grossSalary * (isLarge ? rates.employer.fnal.large : rates.employer.fnal.small),
    formation: grossSalary * (isSmall ? rates.employer.formation.small : rates.employer.formation.large),
    apprentissage: grossSalary * rates.employer.apprentissage,
    atMp: grossSalary * rates.employer.at_mp,
    retraiteComplementaireT1: tranche1 * rates.employer.retraite_complementaire.tranche1.cadre,
    retraiteComplementaireT2: isExecutive ? tranche2 * rates.employer.retraite_complementaire.tranche2.cadre : 0,
    cet: grossSalary * rates.employer.cet,
    prevoyanceCadre: isExecutive ? tranche1 * rates.employer.prevoyance_cadre : 0,
    total: 0,
  };
  
  // Calculer le total
  charges.total = Object.entries(charges)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, value]) => sum + (value as number), 0);
  
  return charges;
}

// Calcul du taux global de charges
export function getGlobalChargesRate(
  grossSalary: number,
  isExecutive: boolean,
  companySize: 'small' | 'medium' | 'large',
  contractType: string = 'cdi'
): number {
  if (grossSalary <= 0) return 0;
  const charges = calculateDetailedCharges(grossSalary, isExecutive, companySize, contractType);
  return charges.total / grossSalary;
}

// Calcul de l'IS
export function calculateIS(resultatAvantIS: number, isPME: boolean): number {
  if (resultatAvantIS <= 0) return 0;
  
  const { taux_reduit_pme, taux_normal, plafond_taux_reduit } = IS_RATES_FR;
  
  if (isPME && resultatAvantIS <= plafond_taux_reduit) {
    return resultatAvantIS * taux_reduit_pme;
  } else if (isPME) {
    return (plafond_taux_reduit * taux_reduit_pme) + ((resultatAvantIS - plafond_taux_reduit) * taux_normal);
  } else {
    return resultatAvantIS * taux_normal;
  }
}

// Calcul de l'amortissement mensuel
export function calculateMonthlyDepreciation(
  purchaseAmount: number,
  depreciationYears: number,
  method: 'linear' | 'degressive' = 'linear'
): number {
  if (method === 'linear') {
    return purchaseAmount / (depreciationYears * 12);
  }
  
  // Dégressif: taux linéaire × coefficient fiscal
  const coef = depreciationYears <= 4 ? DEPRECIATION_COEFFICIENTS[3] :
               depreciationYears <= 6 ? DEPRECIATION_COEFFICIENTS[5] :
               DEPRECIATION_COEFFICIENTS[7];
  const linearRate = 1 / depreciationYears;
  const degressiveRate = linearRate * coef;
  
  // Simplifié: première année taux dégressif, puis amorti mensuellement
  return (purchaseAmount * degressiveRate) / 12;
}

// ============= LOAN & LEASE CALCULATIONS =============

export interface LoanPaymentInfo {
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
}

/**
 * Calculate monthly loan payment using standard amortization formula
 */
export function calculateLoanPayment(
  principal: number,
  annualRatePercent: number,
  durationMonths: number
): LoanPaymentInfo {
  if (principal <= 0 || durationMonths <= 0) {
    return { monthlyPayment: 0, totalInterest: 0, totalCost: 0 };
  }
  
  const monthlyRate = annualRatePercent / 100 / 12;
  
  if (monthlyRate === 0) {
    const monthlyPayment = principal / durationMonths;
    return { monthlyPayment, totalInterest: 0, totalCost: principal };
  }
  
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, durationMonths)) 
                         / (Math.pow(1 + monthlyRate, durationMonths) - 1);
  const totalCost = monthlyPayment * durationMonths;
  const totalInterest = totalCost - principal;
  
  return { monthlyPayment, totalInterest, totalCost };
}

export interface LoanScheduleEntry {
  interest: number;
  capital: number;
  remaining: number;
}

/**
 * Get loan amortization schedule entry for a specific month
 * @param monthIndex 0-based month index from loan start
 */
export function getLoanScheduleEntry(
  principal: number,
  annualRatePercent: number,
  durationMonths: number,
  monthIndex: number
): LoanScheduleEntry {
  if (monthIndex < 0 || monthIndex >= durationMonths || principal <= 0) {
    return { interest: 0, capital: 0, remaining: 0 };
  }
  
  const monthlyRate = annualRatePercent / 100 / 12;
  const { monthlyPayment } = calculateLoanPayment(principal, annualRatePercent, durationMonths);
  
  // Calculate remaining principal at start of this month
  let remaining = principal;
  for (let i = 0; i < monthIndex; i++) {
    const interest = remaining * monthlyRate;
    const capitalPaid = monthlyPayment - interest;
    remaining -= capitalPaid;
  }
  
  const interest = remaining * monthlyRate;
  const capital = monthlyPayment - interest;
  const newRemaining = Math.max(0, remaining - capital);
  
  return { interest, capital, remaining: newRemaining };
}

// Financing types
export const FINANCING_TYPES = [
  { value: 'loan', label: 'Emprunt bancaire' },
  { value: 'lease', label: 'Leasing (LOA/LLD)' },
] as const;
