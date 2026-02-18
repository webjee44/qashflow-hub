import { supabase } from '@/integrations/supabase/client';

export interface CategoryInsert {
  name: string;
  color: string;
  icon: string;
  type: 'income' | 'expense';
  vat_rate?: number;
  parent_id?: string | null;
  forecast_mode?: 'manual' | 'percent_of_revenue';
  forecast_percent?: number;
  user_id: string;
  company_id: string;
}

export const categoryApi = {
  getByCompany: async (companyId: string) => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('company_id', companyId)
      .order('type', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  checkExists: async (companyId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  },

  insertMany: async (categories: CategoryInsert[]) => {
    const { error } = await supabase
      .from('categories')
      .insert(categories as any);

    if (error) throw error;
  },

  create: async (category: CategoryInsert) => {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        ...category,
        vat_rate: category.vat_rate ?? 0,
        parent_id: category.parent_id ?? null,
        forecast_mode: category.forecast_mode ?? 'manual',
        forecast_percent: category.forecast_percent ?? 0,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('categories')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  deleteByParent: async (parentId: string) => {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('parent_id', parentId);

    if (error) throw error;
  },

  updateParent: async (ids: string[], parentId: string | null) => {
    const { error } = await supabase
      .from('categories')
      .update({ parent_id: parentId })
      .in('id', ids);

    if (error) throw error;
  },

  clearParent: async (parentId: string) => {
    const { error } = await supabase
      .from('categories')
      .update({ parent_id: null })
      .eq('parent_id', parentId);

    if (error) throw error;
  },

  updateSortOrder: async (id: string, sortOrder: number, parentId?: string | null) => {
    const updateData: Record<string, unknown> = { sort_order: sortOrder };
    if (parentId !== undefined) {
      updateData.parent_id = parentId;
    }
    const { error } = await supabase
      .from('categories')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  },

  reassignTransactions: async (fromCategoryId: string, toCategoryId: string) => {
    const { error } = await supabase
      .from('transactions')
      .update({ category_id: toCategoryId })
      .eq('category_id', fromCategoryId);

    if (error) throw error;
  },
};
