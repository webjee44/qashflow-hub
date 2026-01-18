// ============================================
// Business Plan Service
// Pure data layer - no UI side effects
// ============================================

import { supabase } from '@/integrations/supabase/client';

export interface BusinessPlan {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  status: 'draft' | 'finalized';
  description: string | null;
  bp_start_date: string | null;
  bp_years: number | null;
  fiscal_year_start_month: number | null;
  fiscal_year_start_day: number | null;
  customer_payment_delay: number | null;
  supplier_payment_delay: number | null;
  initial_cash: number | null;
  tax_regime: string | null;
  is_pme: boolean | null;
  finalized_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type BusinessPlanInsert = Omit<BusinessPlan, 'id' | 'created_at' | 'updated_at'>;
export type BusinessPlanUpdate = Partial<Omit<BusinessPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const businessPlanService = {
  async getByCompanyId(companyId: string): Promise<BusinessPlan[]> {
    const { data, error } = await supabase
      .from('business_plans')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as BusinessPlan[];
  },

  async getAll(): Promise<BusinessPlan[]> {
    const { data, error } = await supabase
      .from('business_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as BusinessPlan[];
  },

  async getById(id: string): Promise<BusinessPlan | null> {
    const { data, error } = await supabase
      .from('business_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data as BusinessPlan;
  },

  async create(data: BusinessPlanInsert): Promise<BusinessPlan> {
    const { data: newBP, error } = await supabase
      .from('business_plans')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return newBP as BusinessPlan;
  },

  async update(id: string, data: BusinessPlanUpdate): Promise<void> {
    const { error } = await supabase
      .from('business_plans')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async finalize(id: string): Promise<void> {
    const { error } = await supabase
      .from('business_plans')
      .update({ 
        status: 'finalized', 
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    if (error) throw error;
  },
};
