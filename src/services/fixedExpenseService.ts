// ============================================
// Fixed Expense Service
// Pure data layer - no UI side effects
// ============================================

import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  FIXED_EXPENSE_CATEGORIES,
  PAYMENT_FREQUENCIES,
  DEFAULT_PAYMENT_MONTHS,
  type FixedExpenseCategory,
  type PaymentFrequency,
} from '@/constants/bpConstants';

export interface BPFixedExpense {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
  name: string;
  category: FixedExpenseCategory;
  monthly_amount: number;
  vat_rate: number;
  is_vat_deductible: boolean;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  payment_frequency: PaymentFrequency;
  payment_months: number[] | null;
  created_at: string;
  updated_at: string;
}

// Re-export constants for backward compatibility
export { FIXED_EXPENSE_CATEGORIES, PAYMENT_FREQUENCIES, DEFAULT_PAYMENT_MONTHS };
export type { FixedExpenseCategory, PaymentFrequency };

export type BPFixedExpenseInsert = Partial<Omit<BPFixedExpense, 'id' | 'created_at' | 'updated_at'>>;
export type BPFixedExpenseUpdate = Partial<Omit<BPFixedExpense, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const fixedExpenseService = {
  async getByBusinessPlanId(businessPlanId: string): Promise<BPFixedExpense[]> {
    const { data, error } = await supabase
      .from('bp_fixed_expenses')
      .select('*')
      .eq('business_plan_id', businessPlanId)
      .order('category', { ascending: true });

    if (error) throw error;
    return (data || []) as BPFixedExpense[];
  },

  async create(userId: string, businessPlanId: string, data: BPFixedExpenseInsert): Promise<BPFixedExpense> {
    const frequency = data.payment_frequency || 'monthly';
    const paymentMonths = data.payment_months || DEFAULT_PAYMENT_MONTHS[frequency];

    const { data: newExpense, error } = await supabase
      .from('bp_fixed_expenses')
      .insert({
        user_id: userId,
        business_plan_id: businessPlanId,
        name: data.name || 'Nouvelle charge',
        category: data.category || 'other',
        monthly_amount: data.monthly_amount || 0,
        vat_rate: data.vat_rate ?? 0.20,
        is_vat_deductible: data.is_vat_deductible ?? true,
        start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
        end_date: data.end_date || null,
        notes: data.notes || null,
        payment_frequency: frequency,
        payment_months: paymentMonths.length > 0 ? paymentMonths : null,
      })
      .select()
      .single();

    if (error) throw error;
    return newExpense as BPFixedExpense;
  },

  async update(id: string, data: BPFixedExpenseUpdate): Promise<void> {
    const { error } = await supabase
      .from('bp_fixed_expenses')
      .update(data)
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bp_fixed_expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Utility methods
  getMonthlyAmount(expense: BPFixedExpense): number {
    const multiplier = PAYMENT_FREQUENCIES[expense.payment_frequency]?.multiplier || 1;
    return expense.monthly_amount / multiplier;
  },

  getCashOutflowForMonth(expense: BPFixedExpense, month: Date): number {
    const monthNum = month.getMonth() + 1;
    
    if (expense.payment_frequency === 'monthly') {
      return expense.monthly_amount;
    }
    
    const paymentMonths = expense.payment_months || DEFAULT_PAYMENT_MONTHS[expense.payment_frequency];
    if (paymentMonths.includes(monthNum)) {
      return expense.monthly_amount;
    }
    
    return 0;
  },

  calculateTotalMonthlyExpenses(expenses: BPFixedExpense[]): number {
    return expenses.reduce((sum, e) => sum + this.getMonthlyAmount(e), 0);
  },
};
