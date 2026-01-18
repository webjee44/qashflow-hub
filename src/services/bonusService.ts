// ============================================
// Bonus Service
// Gestion des primes de partage de la valeur (PPV)
// ============================================

import { supabase } from '@/integrations/supabase/client';

export type BonusType = 'ppv' | 'classic' | '13th_month' | 'performance';

export interface BPBonus {
  id: string;
  user_id: string;
  business_plan_id: string;
  personnel_id: string;
  bonus_type: BonusType;
  amount: number;
  payment_month: string;
  is_exempt: boolean;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type BPBonusInsert = Omit<BPBonus, 'id' | 'created_at' | 'updated_at'>;
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
  async getByBusinessPlanId(businessPlanId: string): Promise<BPBonus[]> {
    const { data, error } = await supabase
      .from('bp_bonuses')
      .select('*')
      .eq('business_plan_id', businessPlanId)
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

  async create(data: BPBonusInsert): Promise<BPBonus> {
    const { data: newBonus, error } = await supabase
      .from('bp_bonuses')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return newBonus as BPBonus;
  },

  async bulkCreate(bonuses: BPBonusInsert[]): Promise<BPBonus[]> {
    if (bonuses.length === 0) return [];
    
    const { data, error } = await supabase
      .from('bp_bonuses')
      .insert(bonuses)
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
