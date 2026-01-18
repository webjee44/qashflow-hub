// ============================================
// useProfitLoss Hook - Re-export from BP module
// This ensures the P&L page uses business_plan_id
// ============================================

export { useProfitLoss } from '@/features/business-plan/hooks/useProfitLoss';
export type { PLRow, FiscalYear, PLData } from '@/features/business-plan/hooks/useProfitLoss';
