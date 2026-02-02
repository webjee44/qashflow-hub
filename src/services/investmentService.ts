// ============================================
// Investment Service
// Pure data layer - no UI side effects
// ============================================

import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface BPInvestment {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
  name: string;
  category: string;
  purchase_date: string;
  purchase_amount: number;
  depreciation_years: number;
  depreciation_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const INVESTMENT_CATEGORIES = {
  equipment: { label: 'Matériel & Équipement', icon: 'Wrench' },
  computer: { label: 'Informatique', icon: 'Laptop' },
  vehicle: { label: 'Véhicule', icon: 'Car' },
  furniture: { label: 'Mobilier', icon: 'Armchair' },
  software: { label: 'Logiciels', icon: 'Code' },
  fittings: { label: 'Aménagements', icon: 'Building' },
  other: { label: 'Autres', icon: 'MoreHorizontal' },
};

export type BPInvestmentInsert = Partial<Omit<BPInvestment, 'id' | 'created_at' | 'updated_at'>>;
export type BPInvestmentUpdate = Partial<Omit<BPInvestment, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const investmentService = {
  async getByCompanyId(companyId: string): Promise<BPInvestment[]> {
    const { data, error } = await supabase
      .from('bp_investments')
      .select('*')
      .eq('company_id', companyId)
      .order('purchase_date', { ascending: true });

    if (error) throw error;
    return (data || []) as BPInvestment[];
  },

  async create(ownerId: string, companyId: string, data: BPInvestmentInsert): Promise<BPInvestment> {
    const { data: newInvestment, error } = await supabase
      .from('bp_investments')
      .insert({
        user_id: ownerId,
        company_id: companyId,
        name: data.name || 'Nouvel investissement',
        category: data.category || 'equipment',
        purchase_date: data.purchase_date || format(new Date(), 'yyyy-MM-dd'),
        purchase_amount: data.purchase_amount || 0,
        depreciation_years: data.depreciation_years || 5,
        depreciation_method: data.depreciation_method || 'linear',
        notes: data.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return newInvestment as BPInvestment;
  },

  async update(id: string, data: BPInvestmentUpdate): Promise<void> {
    const { error } = await supabase
      .from('bp_investments')
      .update(data)
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bp_investments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Utility methods
  calculateTotalInvestments(investments: BPInvestment[]): number {
    return investments.reduce((sum, inv) => sum + Number(inv.purchase_amount), 0);
  },

  calculateYearlyDepreciation(investments: BPInvestment[]): number {
    return investments.reduce((sum, inv) => {
      return sum + (Number(inv.purchase_amount) / inv.depreciation_years);
    }, 0);
  },
};
