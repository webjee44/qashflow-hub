// ============================================
// Snapshot API - Pure data access layer
// No UI side effects (no toasts)
// ============================================

import { supabase } from '@/integrations/supabase/client';

export interface BPSnapshot {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  snapshot_data: {
    revenue_streams: any[];
    fixed_expenses: any[];
    personnel: any[];
    investments: any[];
    financings: any[];
    settings: any;
    created_at: string;
  };
  created_at: string;
}

export const snapshotApi = {
  async getByCompanyId(companyId: string): Promise<BPSnapshot[]> {
    const { data, error } = await supabase
      .from('bp_snapshots')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as BPSnapshot[];
  },

  async getAll(): Promise<BPSnapshot[]> {
    const { data, error } = await supabase
      .from('bp_snapshots')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as BPSnapshot[];
  },

  async create(params: {
    userId: string;
    companyId: string | null;
    name: string;
    description: string | null;
    snapshotData: BPSnapshot['snapshot_data'];
  }): Promise<BPSnapshot> {
    const { data, error } = await supabase
      .from('bp_snapshots')
      .insert([{
        user_id: params.userId,
        company_id: params.companyId,
        name: params.name,
        description: params.description,
        snapshot_data: params.snapshotData as unknown as any,
      }])
      .select()
      .single();

    if (error) throw error;
    return data as BPSnapshot;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('bp_snapshots')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
