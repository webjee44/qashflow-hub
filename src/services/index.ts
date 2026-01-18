// ============================================
// Services Index
// Re-export all services for convenient imports
// ============================================

export { 
  businessPlanService, 
  type BusinessPlan, 
  type BusinessPlanInsert, 
  type BusinessPlanUpdate 
} from './businessPlanService';

export { 
  revenueStreamService, 
  type BPRevenueStream, 
  type BPRevenueStreamInsert, 
  type BPRevenueStreamUpdate,
  type RevenueModel,
} from './revenueStreamService';

export { 
  fixedExpenseService, 
  type BPFixedExpense, 
  type BPFixedExpenseInsert, 
  type BPFixedExpenseUpdate, 
  FIXED_EXPENSE_CATEGORIES, 
  PAYMENT_FREQUENCIES, 
  DEFAULT_PAYMENT_MONTHS, 
  type PaymentFrequency,
  type FixedExpenseCategory,
} from './fixedExpenseService';

export { 
  personnelService, 
  type BPPersonnel, 
  type BPPersonnelInsert, 
  type BPPersonnelUpdate, 
  WORKER_TYPES, 
  CONTRACT_TYPES, 
  type WorkerType 
} from './personnelService';

export { 
  investmentService, 
  type BPInvestment, 
  type BPInvestmentInsert, 
  type BPInvestmentUpdate, 
  INVESTMENT_CATEGORIES 
} from './investmentService';

export { 
  financingService, 
  type BPFinancing, 
  type BPFinancingInsert, 
  type BPFinancingUpdate 
} from './financingService';

export { 
  bonusService, 
  BONUS_TYPES,
  type BPBonus, 
  type BPBonusInsert, 
  type BPBonusUpdate,
  type BonusType,
} from './bonusService';
