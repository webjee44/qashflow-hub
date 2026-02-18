// ============================================
// Note API - Pure data access layer
// No UI side effects (no toasts)
// ============================================

import { supabase } from '@/integrations/supabase/client';

export interface BPNote {
  id: string;
  user_id: string;
  company_id: string | null;
  section: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export type BPSection = 
  | 'executive_summary'
  | 'revenue'
  | 'expenses'
  | 'personnel'
  | 'investments'
  | 'financing'
  | 'pnl'
  | 'balance_sheet'
  | 'cash_flow'
  | 'scenarios'
  | 'ratios'
  | 'funding_plan'
  | 'stocks'
  | 'team';

export const noteApi = {
  async getByCompanyId(companyId: string): Promise<BPNote[]> {
    const { data, error } = await supabase
      .from('bp_notes')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return (data || []) as BPNote[];
  },

  async getAll(): Promise<BPNote[]> {
    const { data, error } = await supabase
      .from('bp_notes')
      .select('*');

    if (error) throw error;
    return (data || []) as BPNote[];
  },

  async upsert(params: {
    existingNote: BPNote | undefined;
    userId: string;
    companyId: string | null;
    section: BPSection;
    content: string;
  }): Promise<void> {
    if (params.existingNote) {
      const { error } = await supabase
        .from('bp_notes')
        .update({ content: params.content, updated_at: new Date().toISOString() })
        .eq('id', params.existingNote.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('bp_notes')
        .insert({
          user_id: params.userId,
          company_id: params.companyId,
          section: params.section,
          content: params.content,
        });
      if (error) throw error;
    }
  },

  async deleteBySection(noteId: string): Promise<void> {
    const { error } = await supabase
      .from('bp_notes')
      .delete()
      .eq('id', noteId);
    if (error) throw error;
  },
};
