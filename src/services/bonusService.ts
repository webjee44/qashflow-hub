// ============================================
// Bonus Service
// Gestion des primes de partage de la valeur (PPV)
// Now uses company_id via personnel relationship
// ============================================

import { supabase } from '@/integrations/supabase/client';

export type BonusType = 'ppv' | 'classic' | '13th_month' | 'performance';

export interface BPBonus {
  id: string;
  user_id: string;
  business_plan_id: string; // Still in DB but not used for filtering
  personnel_id: string;
  bonus_type: BonusType;
  amount: number;
  payment_month: string;
  is_exempt: boolean;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type BPBonusInsert = Omit<BPBonus, 'id' | 'created_at' | 'updated_at' | 'business_plan_id'> & { business_plan_id?: string };
export type BPBonusUpdate = Partial<Omit<BPBonus, 'id' | 'user_id' | 'business_plan_id' | 'created_at' | 'updated_at'>>;

export const BONUS_TYPES = {
  ppv: { 
    label: 'Prime Macron (PPV)', 
    icon: 'Gift',
    exempt: true,
    description: 'Prime de Partage de la Valeur - Exonérée jusqu\'à 3 000€ (ou 6 000€ avec accord d\'intéressement)'
  },
  classic: { 
    label: 'Prime classique', 
    icon: 'Banknote',
    exempt: false,
    description: 'Prime soumise aux cotisations sociales et à l\'impôt'
  },
  '13th_month': { 
    label: '13ème mois', 
    icon: 'Calendar',
    exempt: false,
    description: 'Prime de fin d\'année équivalente à un mois de salaire'
  },
  performance: { 
    label: 'Prime de performance', 
    icon: 'TrendingUp',
    exempt: false,
    description: 'Prime liée aux objectifs individuels ou collectifs'
  },
} as const;

export const bonusService = {
  // Get bonuses by personnel IDs (derived from company personnel)
  async getByPersonnelIds(personnelIds: string[]): Promise<BPBonus[]> {
    if (personnelIds.length === 0) return [];
    const { data, error } = await supabase
      .from('bp_bonuses')
      .select('*')
      .in('personnel_id', personnelIds)
      .order('payment_month', { ascending: true });

    if (error) throw error;
    return (data || []) as BPBonus[];
  },

  async getByPersonnelId(personnelId: string): Promise<BPBonus[]> {
    const { data, error } = await supabase
      .from('bp_bonuses')
      .select('*')
      .eq('personnel_id', personnelId)
      .order('payment_month', { ascending: true });

    if (error) throw error;
    return (data || []) as BPBonus[];
  },

  async create(userId: string, data: Omit<BPBonusInsert, 'user_id'>): Promise<BPBonus> {
    // business_plan_id is required by DB but not used for filtering
    // We set a placeholder value since it's not relevant anymore
    const { data: newBonus, error } = await supabase
      .from('bp_bonuses')
      .insert({
        ...data,
        user_id: userId,
        business_plan_id: data.business_plan_id || '00000000-0000-0000-0000-000000000000', // Legacy field
      })
      .select()
      .single();

    if (error) throw error;
    return newBonus as BPBonus;
  },

  async bulkCreate(userId: string, bonuses: Omit<BPBonusInsert, 'user_id'>[]): Promise<BPBonus[]> {
    if (bonuses.length === 0) return [];
    
    const insertData = bonuses.map(b => ({
      ...b,
      user_id: userId,
      business_plan_id: b.business_plan_id || '00000000-0000-0000-0000-000000000000', // Legacy field
    }));
    
    const { data, error } = await supabase
      .from('bp_bonuses')
      .insert(insertData)
      .select();

    if (error) throw error;
    return (data || []) as BPBonus[];
  },

  async update(id: string, data: BPBonusUpdate): Promise<void> {
    const { error } = await supabase
      .from('bp_bonuses')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bp_bonuses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async deleteByPersonnelId(personnelId: string): Promise<void> {
    const { error } = await supabase
      .from('bp_bonuses')
      .delete()
      .eq('personnel_id', personnelId);

    if (error) throw error;
  },

  // Utilitaires de calcul
  calculateTotalByType(bonuses: BPBonus[], type?: BonusType): number {
    const filtered = type ? bonuses.filter(b => b.bonus_type === type) : bonuses;
    return filtered.reduce((sum, b) => sum + (b.amount || 0), 0);
  },

  calculateExemptAmount(bonuses: BPBonus[]): number {
    return bonuses
      .filter(b => b.is_exempt)
      .reduce((sum, b) => sum + (b.amount || 0), 0);
  },

  calculateTaxableAmount(bonuses: BPBonus[]): number {
    return bonuses
      .filter(b => !b.is_exempt)
      .reduce((sum, b) => sum + (b.amount || 0), 0);
  },

  getTotalByPersonnel(bonuses: BPBonus[], personnelId: string): number {
    return bonuses
      .filter(b => b.personnel_id === personnelId)
      .reduce((sum, b) => sum + (b.amount || 0), 0);
  },
};
