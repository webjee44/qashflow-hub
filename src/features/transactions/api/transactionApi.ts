import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Transaction = Tables<'transactions'>;

export const transactionApi = {
  getByCompany: async (companyId: string, limit?: number): Promise<Transaction[]> => {
    let q = supabase
      .from('transactions')
      .select('*')
      .is('deleted_at', null)
      .eq('company_id', companyId)
      .order('date', { ascending: false });

    if (limit) {
      q = q.limit(limit);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },

  updateCategory: async (transactionId: string, categoryId: string | null): Promise<void> => {
    const { error } = await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .eq('id', transactionId);

    if (error) throw error;
  },

  bulkUpdateCategory: async (transactionIds: string[], categoryId: string | null): Promise<void> => {
    const { error } = await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .in('id', transactionIds);

    if (error) throw error;
  },

  findById: async (id: string): Promise<Transaction | null> => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  softDelete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  createMany: async (transactions: Tables<'transactions'>[] | Record<string, unknown>[]): Promise<void> => {
    const { error } = await supabase
      .from('transactions')
      .insert(transactions as any);

    if (error) throw error;
  },

  getRecentByCompany: async (companyId: string, limit: number = 6): Promise<Transaction[]> => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
