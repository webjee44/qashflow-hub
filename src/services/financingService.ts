// ============================================
// Financing Service
// Pure data layer - no UI side effects
// ============================================

import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { calculateLoanPayment } from '@/lib/french-rates';

export interface BPFinancing {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
  investment_id: string | null;
  financing_type: 'capital' | 'loan' | 'grant' | 'current_account';
  name: string;
  amount: number;
  interest_rate: number;
  duration_months: number;
  monthly_payment: number;
  start_date: string;
  end_date: string | null;
  is_blocked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type BPFinancingInsert = Partial<Omit<BPFinancing, 'id' | 'created_at' | 'updated_at'>>;
export type BPFinancingUpdate = Partial<Omit<BPFinancing, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const financingService = {
  async getByCompanyId(companyId: string): Promise<BPFinancing[]> {
    const { data, error } = await supabase
      .from('bp_financings')
      .select('*')
      .eq('company_id', companyId)
      .order('financing_type', { ascending: true });

    if (error) throw error;
    return (data || []) as BPFinancing[];
  },

  async create(userId: string, companyId: string, data: BPFinancingInsert): Promise<BPFinancing> {
    // Calculate monthly payment for loans
    let monthlyPayment = 0;
    if (data.financing_type === 'loan' && data.amount && data.interest_rate && data.duration_months) {
      const paymentInfo = calculateLoanPayment(data.amount, data.interest_rate, data.duration_months);
      monthlyPayment = paymentInfo.monthlyPayment;
    }

    const { data: newFinancing, error } = await supabase
      .from('bp_financings')
      .insert({
        user_id: userId,
        company_id: companyId,
        name: data.name || 'Nouveau financement',
        financing_type: data.financing_type || 'loan',
        amount: data.amount || 0,
        interest_rate: data.interest_rate || 0,
        duration_months: data.duration_months || 60,
        monthly_payment: monthlyPayment,
        start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
        end_date: data.end_date || null,
        investment_id: data.investment_id || null,
        is_blocked: data.is_blocked ?? false,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return newFinancing as BPFinancing;
  },

  async update(id: string, data: BPFinancingUpdate): Promise<void> {
    const { error } = await supabase
      .from('bp_financings')
      .update(data)
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bp_financings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Utility methods
  calculateTotals(financings: BPFinancing[]): {
    totalCapital: number;
    totalLoans: number;
    totalGrants: number;
    totalFunding: number;
  } {
    const totalCapital = financings
      .filter(f => f.financing_type === 'capital')
      .reduce((sum, f) => sum + Number(f.amount), 0);

    const totalLoans = financings
      .filter(f => f.financing_type === 'loan')
      .reduce((sum, f) => sum + Number(f.amount), 0);

    const totalGrants = financings
      .filter(f => f.financing_type === 'grant')
      .reduce((sum, f) => sum + Number(f.amount), 0);

    return {
      totalCapital,
      totalLoans,
      totalGrants,
      totalFunding: totalCapital + totalLoans + totalGrants,
    };
  },
};
