// ============================================
// Business Plan API Layer
// Re-exports all BP data access services
// This is the ONLY layer authorized to call supabase.from() for BP data
// ============================================

// Core Business Plan
export { 
  businessPlanService, 
  type BusinessPlan, 
  type BusinessPlanInsert, 
  type BusinessPlanUpdate 
} from '@/services/businessPlanService';

// Revenue Streams
export { 
  revenueStreamService, 
  type BPRevenueStream, 
  type BPRevenueStreamInsert, 
  type BPRevenueStreamUpdate,
  type RevenueModel,
} from '@/services/revenueStreamService';

// Fixed Expenses
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
} from '@/services/fixedExpenseService';

// Personnel
export { 
  personnelService, 
  type BPPersonnel, 
  type BPPersonnelInsert, 
  type BPPersonnelUpdate, 
  WORKER_TYPES, 
  CONTRACT_TYPES, 
  type WorkerType 
} from '@/services/personnelService';

// Investments
export { 
  investmentService, 
  type BPInvestment, 
  type BPInvestmentInsert, 
  type BPInvestmentUpdate, 
  INVESTMENT_CATEGORIES 
} from '@/services/investmentService';

// Financings
export { 
  financingService, 
  type BPFinancing, 
  type BPFinancingInsert, 
  type BPFinancingUpdate 
} from '@/services/financingService';

// Bonuses
export { 
  bonusService, 
  BONUS_TYPES,
  type BPBonus, 
  type BPBonusInsert, 
  type BPBonusUpdate,
  type BonusType,
} from '@/services/bonusService';

// Snapshots
export { snapshotApi, type BPSnapshot } from './snapshotApi';

// Notes
export { noteApi, type BPNote, type BPSection } from './noteApi';
