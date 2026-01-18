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

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('business_plans')
      .delete()
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

  async duplicate(id: string, userId: string): Promise<BusinessPlan> {
    // Get the original BP
    const original = await this.getById(id);
    if (!original) throw new Error('Business plan not found');

    // Create a copy
    const { data: newBP, error } = await supabase
      .from('business_plans')
      .insert({
        user_id: userId,
        company_id: original.company_id,
        name: `${original.name} (copie)`,
        status: 'draft',
        description: original.description,
        bp_start_date: original.bp_start_date,
        bp_years: original.bp_years,
        fiscal_year_start_month: original.fiscal_year_start_month,
        fiscal_year_start_day: original.fiscal_year_start_day,
        customer_payment_delay: original.customer_payment_delay,
        supplier_payment_delay: original.supplier_payment_delay,
        initial_cash: original.initial_cash,
        tax_regime: original.tax_regime,
        is_pme: original.is_pme,
      })
      .select()
      .single();

    if (error) throw error;
    return newBP as BusinessPlan;
  },
};
