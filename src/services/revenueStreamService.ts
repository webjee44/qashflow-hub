// ============================================
// Revenue Stream Service
// Pure data layer - no UI side effects
// ============================================

import { supabase } from '@/integrations/supabase/client';
import { type RevenueModel } from '@/constants/bpConstants';

export interface BPRevenueStream {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
  name: string;
  description: string | null;
  color: string;
  model: RevenueModel;
  is_active: boolean;
  initial_subscribers: number;
  monthly_price: number;
  churn_rate: number;
  growth_rate: number;
  vat_rate: number;
  bad_debt_rate: number;
  annual_growth_rate: number;
  growth_rate_year2: number;
  growth_rate_year3: number;
  growth_rate_year4: number;
  created_at: string;
  updated_at: string;
}

export type { RevenueModel };

export type BPRevenueStreamInsert = Partial<Omit<BPRevenueStream, 'id' | 'created_at' | 'updated_at'>>;
export type BPRevenueStreamUpdate = Partial<Omit<BPRevenueStream, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const revenueStreamService = {
  async getByBusinessPlanId(businessPlanId: string): Promise<BPRevenueStream[]> {
    const { data, error } = await supabase
      .from('bp_revenue_streams')
      .select('*')
      .eq('business_plan_id', businessPlanId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as BPRevenueStream[];
  },

  async create(userId: string, businessPlanId: string, data: BPRevenueStreamInsert): Promise<BPRevenueStream> {
    const { data: newStream, error } = await supabase
      .from('bp_revenue_streams')
      .insert({
        user_id: userId,
        business_plan_id: businessPlanId,
        name: data.name || 'Nouveau flux',
        description: data.description || null,
        color: data.color || 'hsl(142, 76%, 36%)',
        model: data.model || 'fixed',
        is_active: true,
        initial_subscribers: data.initial_subscribers || 0,
        monthly_price: data.monthly_price || 0,
        churn_rate: data.churn_rate || 0.05,
        growth_rate: data.growth_rate || 0.10,
        vat_rate: data.vat_rate || 0.20,
        bad_debt_rate: data.bad_debt_rate || 0,
        annual_growth_rate: data.annual_growth_rate ?? 0.10,
        growth_rate_year2: data.growth_rate_year2 ?? 0.10,
        growth_rate_year3: data.growth_rate_year3 ?? 0.10,
        growth_rate_year4: data.growth_rate_year4 ?? 0.10,
      })
      .select()
      .single();

    if (error) throw error;
    return newStream as BPRevenueStream;
  },

  async update(id: string, data: BPRevenueStreamUpdate): Promise<void> {
    const { error } = await supabase
      .from('bp_revenue_streams')
      .update(data)
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bp_revenue_streams')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Utility method
  calculateTotalMonthlyRevenue(streams: BPRevenueStream[]): number {
    return streams.reduce((sum, s) => {
      if (s.model === 'subscription') {
        return sum + (s.initial_subscribers * s.monthly_price);
      }
      return sum + s.monthly_price;
    }, 0);
  },
};
