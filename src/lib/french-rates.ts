// Taux URSSAF 2026 officiels - France
// Source: URSSAF.fr, mise à jour janvier 2026
export const URSSAF_RATES_2026 = {
  // Cotisations patronales (taux employeur)
  employer: {
    // Assurance maladie
    maladie_base: 0.07,                              // 7% base
    maladie_complement_cadre: 0.06,                  // 6% complément cadres
    csa: 0.003,                                      // 0.3% Contribution solidarité autonomie
    
    // Vieillesse
    vieillesse_deplafonnee: 0.0202,                  // 2.02%
    vieillesse_plafonnee: 0.0855,                    // 8.55% (jusqu'au PASS)
    
    // Famille
    allocations_familiales: { full: 0.0525, reduced: 0.0345 }, // 5.25% ou 3.45%
    
    // Chômage
    chomage: 0.0405,                                 // 4.05%
    ags: 0.0015,                                     // 0.15%
    
    // Formation
    fnal: { small: 0.001, large: 0.005 },           // 0.1% (<50) ou 0.5% (≥50)
    formation: { small: 0.0055, large: 0.01 },      // 0.55% (<11) ou 1% (≥11)
    apprentissage: 0.0068,                           // 0.68%
    
    // Accidents du travail (taux moyen, varie selon activité)
    at_mp: { min: 0.0089, avg: 0.02, max: 0.05 },   // 0.89% à 5%, moyenne ~2%
    
    // Retraite complémentaire Agirc-Arrco
    retraite_complementaire: {
      tranche1: 0.0601,                              // 6.01% T1 (employeur)
      tranche2: 0.1295,                              // 12.95% T2 cadres
    },
    cet: 0.0021,                                     // 0.21% Contribution équilibre technique
    apec: 0.00036,                                   // 0.036% APEC (cadres)
    
    // Prévoyance & Mutuelle (cadres obligatoire)
    prevoyance_cadre: 0.015,                         // 1.5% prévoyance obligatoire cadres
    mutuelle_forfait_moyen: 150,                     // ~150€/mois forfait moyen mutuelle
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

// Forfait social sur indemnités de rupture (2026)
// Applicable sur la part exonérée de cotisations sociales (jusqu'à 2 PASS)
export const SEVERANCE_FORFAIT_SOCIAL = 0.20; // 20%

// Calcul du coût employeur total pour une indemnité de départ
export function calculateSeveranceEmployerCost(
  severanceAmount: number,
  employerContributionRate: number = SEVERANCE_FORFAIT_SOCIAL
): { grossAmount: number; employerContribution: number; totalCost: number } {
  const grossAmount = severanceAmount;
  const employerContribution = grossAmount * employerContributionRate;
  return {
    grossAmount,
    employerContribution,
    totalCost: grossAmount + employerContribution,
  };
}

// Tranches IS France 2026
export const IS_RATES_FR = {
  taux_reduit_pme: 0.15,     // 15% jusqu'à 42 500€
  taux_normal: 0.25,         // 25%
  plafond_taux_reduit: 42500,
};

// Barème IR France 2026 (revenus 2025)
export const IR_BRACKETS_FR = [
  { max: 11294, rate: 0 },       // 0%
  { max: 28797, rate: 0.11 },    // 11%
  { max: 82341, rate: 0.30 },    // 30%
  { max: 177106, rate: 0.41 },   // 41%
  { max: Infinity, rate: 0.45 }, // 45%
];

// Abattements micro-entreprise France 2026
export const MICRO_ABATEMENTS_FR = {
  services: 0.34,      // 34% d'abattement pour BNC/services
  commerce: 0.71,      // 71% d'abattement pour BIC/commerce
  mixed: 0.50,         // 50% d'abattement moyen
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
  maladieBase: number;
  maladieComplementCadre: number;
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
  apec: number;
  prevoyanceCadre: number;
  mutuelle: number;
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
  
  // Déterminer les taux réduits (alloc familiales < 3.5 SMIC)
  const salaryRatio = grossSalary / smic;
  const useAFReduit = salaryRatio <= rates.seuils.af_reduit;
  const isLarge = companySize === 'large';
  const isSmall = companySize === 'small';
  
  // Tranches pour retraite complémentaire
  const tranche1 = Math.min(grossSalary, pass);
  const tranche2 = Math.max(0, Math.min(grossSalary, pass * 8) - pass);
  
  // Calculer chaque cotisation
  const charges: DetailedCharges = {
    // Maladie: base 7% + complément 6% pour cadres
    maladieBase: grossSalary * rates.employer.maladie_base,
    maladieComplementCadre: isExecutive ? grossSalary * rates.employer.maladie_complement_cadre : 0,
    csa: grossSalary * rates.employer.csa,
    vieillesseDeplafonnee: grossSalary * rates.employer.vieillesse_deplafonnee,
    vieillessePlafonnee: tranche1 * rates.employer.vieillesse_plafonnee,
    allocationsFamiliales: grossSalary * (useAFReduit ? rates.employer.allocations_familiales.reduced : rates.employer.allocations_familiales.full),
    chomage: contractType === 'intern' || contractType === 'stage' ? 0 : grossSalary * rates.employer.chomage,
    ags: contractType === 'intern' || contractType === 'stage' ? 0 : grossSalary * rates.employer.ags,
    fnal: grossSalary * (isLarge ? rates.employer.fnal.large : rates.employer.fnal.small),
    formation: grossSalary * (isSmall ? rates.employer.formation.small : rates.employer.formation.large),
    apprentissage: grossSalary * rates.employer.apprentissage,
    atMp: grossSalary * rates.employer.at_mp.avg,
    retraiteComplementaireT1: tranche1 * rates.employer.retraite_complementaire.tranche1,
    retraiteComplementaireT2: isExecutive ? tranche2 * rates.employer.retraite_complementaire.tranche2 : 0,
    cet: grossSalary * rates.employer.cet,
    apec: isExecutive ? tranche1 * rates.employer.apec : 0,
    prevoyanceCadre: isExecutive ? tranche1 * rates.employer.prevoyance_cadre : 0,
    // Mutuelle forfaitaire (obligatoire pour tous)
    mutuelle: rates.employer.mutuelle_forfait_moyen,
    total: 0,
  };
  
  // Calculer le total
  charges.total = Object.entries(charges)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, value]) => sum + (value as number), 0);
  
  return charges;
}

// Calcul du taux global de charges (SANS mutuelle forfaitaire)
// La mutuelle est un forfait fixe (150€), pas un pourcentage du salaire
export function getGlobalChargesRate(
  grossSalary: number,
  isExecutive: boolean,
  companySize: 'small' | 'medium' | 'large',
  contractType: string = 'cdi'
): number {
  if (grossSalary <= 0) return 0;
  const charges = calculateDetailedCharges(grossSalary, isExecutive, companySize, contractType);
  // Exclure la mutuelle forfaitaire du calcul du taux
  const chargesWithoutMutuelle = charges.total - charges.mutuelle;
  return chargesWithoutMutuelle / grossSalary;
}

// Constante pour la mutuelle forfaitaire (utilisée séparément)
export const MUTUELLE_FORFAIT = URSSAF_RATES_2026.employer.mutuelle_forfait_moyen;

// Calcul de l'IS (Impôt sur les Sociétés)
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

// Calcul de l'IR (Impôt sur le Revenu) - barème progressif
export function calculateIR(revenuImposable: number): number {
  if (revenuImposable <= 0) return 0;
  
  let impot = 0;
  let previousMax = 0;
  
  for (const bracket of IR_BRACKETS_FR) {
    if (revenuImposable <= previousMax) break;
    
    const taxableInBracket = Math.min(revenuImposable, bracket.max) - previousMax;
    impot += taxableInBracket * bracket.rate;
    previousMax = bracket.max;
  }
  
  return impot;
}

// Calcul de l'impôt micro-entreprise (versement libératoire)
export function calculateMicroTax(chiffreAffaires: number, activityType: 'services' | 'commerce' | 'mixed' = 'services'): number {
  if (chiffreAffaires <= 0) return 0;
  
  // Abattement forfaitaire
  const abatement = MICRO_ABATEMENTS_FR[activityType];
  const beneficeImposable = chiffreAffaires * (1 - abatement);
  
  // Appliquer le barème IR sur le bénéfice imposable
  return calculateIR(beneficeImposable);
}

// Calcul unifié selon le régime fiscal
export type TaxRegime = 'is' | 'ir' | 'micro';

export interface TaxCalculationResult {
  tax: number;
  regime: TaxRegime;
  effectiveRate: number;
  details: {
    base: number;
    abatement?: number;
    brackets?: { amount: number; rate: number }[];
  };
}

export function calculateTaxByRegime(
  resultatAvantIS: number,
  regime: TaxRegime,
  options: {
    isPME?: boolean;
    activityType?: 'services' | 'commerce' | 'mixed';
    chiffreAffaires?: number; // Pour micro, on peut utiliser le CA au lieu du résultat
  } = {}
): TaxCalculationResult {
  const { isPME = true, activityType = 'services', chiffreAffaires } = options;
  
  switch (regime) {
    case 'is': {
      const tax = calculateIS(resultatAvantIS, isPME);
      return {
        tax,
        regime: 'is',
        effectiveRate: resultatAvantIS > 0 ? (tax / resultatAvantIS) * 100 : 0,
        details: {
          base: resultatAvantIS,
          brackets: isPME && resultatAvantIS > IS_RATES_FR.plafond_taux_reduit
            ? [
                { amount: IS_RATES_FR.plafond_taux_reduit, rate: 15 },
                { amount: resultatAvantIS - IS_RATES_FR.plafond_taux_reduit, rate: 25 },
              ]
            : [{ amount: resultatAvantIS, rate: isPME ? 15 : 25 }],
        },
      };
    }
    
    case 'ir': {
      const tax = calculateIR(resultatAvantIS);
      return {
        tax,
        regime: 'ir',
        effectiveRate: resultatAvantIS > 0 ? (tax / resultatAvantIS) * 100 : 0,
        details: {
          base: resultatAvantIS,
        },
      };
    }
    
    case 'micro': {
      // Pour micro, on utilise le CA si disponible, sinon le résultat
      const base = chiffreAffaires ?? resultatAvantIS;
      const abatement = MICRO_ABATEMENTS_FR[activityType];
      const beneficeImposable = base * (1 - abatement);
      const tax = calculateIR(beneficeImposable);
      
      return {
        tax,
        regime: 'micro',
        effectiveRate: base > 0 ? (tax / base) * 100 : 0,
        details: {
          base,
          abatement: abatement * 100,
        },
      };
    }
    
    default:
      return {
        tax: 0,
        regime: 'is',
        effectiveRate: 0,
        details: { base: 0 },
      };
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
