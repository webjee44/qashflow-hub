import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'income' | 'expense';
  vat_rate: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  company_id?: string | null;
  parent_id?: string | null;
}

export interface CategoryGroup {
  group: Category | null;
  children: Category[];
}

const defaultCategories = [
  { name: 'Ventes', color: 'hsl(142, 76%, 36%)', icon: 'TrendingUp', type: 'income' as const, vat_rate: 0.20 },
  { name: 'Prestations', color: 'hsl(200, 80%, 50%)', icon: 'Briefcase', type: 'income' as const, vat_rate: 0.20 },
  { name: 'Remboursements', color: 'hsl(173, 80%, 40%)', icon: 'RotateCcw', type: 'income' as const, vat_rate: 0 },
  { name: 'Salaires', color: 'hsl(0, 84%, 60%)', icon: 'Users', type: 'expense' as const, vat_rate: 0 },
  { name: 'Loyer', color: 'hsl(280, 60%, 50%)', icon: 'Building', type: 'expense' as const, vat_rate: 0.20 },
  { name: 'Fournisseurs', color: 'hsl(38, 92%, 50%)', icon: 'Package', type: 'expense' as const, vat_rate: 0.20 },
  { name: 'Marketing', color: 'hsl(320, 70%, 50%)', icon: 'Megaphone', type: 'expense' as const, vat_rate: 0.20 },
  { name: 'Logiciels', color: 'hsl(221, 83%, 53%)', icon: 'Laptop', type: 'expense' as const, vat_rate: 0.20 },
];

// Fetch function for categories
async function fetchCategories(userId: string, companyId?: string | null): Promise<Category[]> {
  let query = supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('type', { ascending: true })
    .order('name', { ascending: true });

  if (companyId) {
    query = query.or(`company_id.eq.${companyId},company_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export function useCategories() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const queryKey = ['categories', user?.id, currentCompany?.id];

  // Main query with React Query caching
  const { data: categories = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchCategories(user!.id, currentCompany?.id),
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes cache for categories
  });

  const initializeDefaultCategories = async () => {
    if (!user) return;
    
    try {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (existing && existing.length > 0) return;

      const categoriesToInsert = defaultCategories.map(cat => ({
        ...cat,
        user_id: user.id,
        company_id: currentCompany?.id || null
      }));

      const { error } = await supabase
        .from('categories')
        .insert(categoriesToInsert);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey });
      toast.success('Catégories par défaut créées');
    } catch (error) {
      logError('Error initializing categories:', error);
    }
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (category: {
      name: string;
      color: string;
      icon: string;
      type: 'income' | 'expense';
      vat_rate?: number;
    }) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...category,
          vat_rate: category.vat_rate ?? 0,
          user_id: user.id,
          company_id: currentCompany?.id || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Catégorie créée avec succès');
    },
    onError: (error) => {
      logError('Error creating category:', error);
      toast.error('Erreur lors de la création');
    },
  });

  const createCategory = async (category: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
    vat_rate?: number;
  }) => {
    try {
      return await createMutation.mutateAsync(category);
    } catch {
      return null;
    }
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Category> }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Catégorie mise à jour');
    },
    onError: (error) => {
      logError('Error updating category:', error);
      toast.error('Erreur lors de la mise à jour');
    },
  });

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      return await updateMutation.mutateAsync({ id, updates });
    } catch {
      return null;
    }
  };

  // Delete mutation with optional reassignment
  const deleteMutation = useMutation({
    mutationFn: async ({ id, reassignToId }: { id: string; reassignToId?: string | null }) => {
      // If reassignToId is provided, reassign all transactions first
      if (reassignToId) {
        const { error: reassignError } = await supabase
          .from('transactions')
          .update({ category_id: reassignToId })
          .eq('category_id', id);

        if (reassignError) throw reassignError;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { reassignToId }) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(reassignToId 
        ? 'Catégorie supprimée et transactions reclassées' 
        : 'Catégorie supprimée'
      );
    },
    onError: (error) => {
      logError('Error deleting category:', error);
      toast.error('Erreur lors de la suppression');
    },
  });

  const deleteCategory = async (id: string, reassignToId?: string | null) => {
    try {
      await deleteMutation.mutateAsync({ id, reassignToId });
    } catch {
      // Error handled in mutation
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Get only parent/group categories
  const parentCategories = (type: 'income' | 'expense') => {
    const typeCats = type === 'income' ? incomeCategories : expenseCategories;
    const parentIds = new Set(typeCats.filter(c => c.parent_id).map(c => c.parent_id));
    return typeCats.filter(c => parentIds.has(c.id));
  };

  // Group categories by parent
  const getGroupedCategories = (type: 'income' | 'expense'): CategoryGroup[] => {
    const typeCats = type === 'income' ? incomeCategories : expenseCategories;
    const groups: CategoryGroup[] = [];
    const childrenByParent = new Map<string, Category[]>();
    const topLevelCats: Category[] = [];

    typeCats.forEach(cat => {
      if (cat.parent_id) {
        const existing = childrenByParent.get(cat.parent_id) || [];
        existing.push(cat);
        childrenByParent.set(cat.parent_id, existing);
      }
    });

    typeCats.forEach(cat => {
      if (!cat.parent_id) {
        if (childrenByParent.has(cat.id)) {
          groups.push({
            group: cat,
            children: childrenByParent.get(cat.id)!.sort((a, b) => a.name.localeCompare(b.name))
          });
        } else {
          topLevelCats.push(cat);
        }
      }
    });

    if (topLevelCats.length > 0) {
      groups.unshift({
        group: null,
        children: topLevelCats.sort((a, b) => a.name.localeCompare(b.name))
      });
    }

    return groups.sort((a, b) => {
      if (!a.group) return -1;
      if (!b.group) return 1;
      return a.group.name.localeCompare(b.group.name);
    });
  };

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      color: string;
      type: 'income' | 'expense';
      categoryIds: string[];
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { data: groupData, error: groupError } = await supabase
        .from('categories')
        .insert({
          name: data.name,
          color: data.color,
          icon: 'Folder',
          type: data.type,
          vat_rate: 0,
          user_id: user.id,
          company_id: currentCompany?.id || null,
          parent_id: null
        })
        .select()
        .single();

      if (groupError) throw groupError;

      if (data.categoryIds.length > 0) {
        const { error: updateError } = await supabase
          .from('categories')
          .update({ parent_id: groupData.id })
          .in('id', data.categoryIds);

        if (updateError) throw updateError;
      }

      return groupData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Groupe créé avec succès');
    },
    onError: (error) => {
      logError('Error creating group:', error);
      toast.error('Erreur lors de la création du groupe');
    },
  });

  const createGroup = async (data: {
    name: string;
    color: string;
    type: 'income' | 'expense';
    categoryIds: string[];
  }) => {
    try {
      return await createGroupMutation.mutateAsync(data);
    } catch {
      return null;
    }
  };

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async ({
      groupId,
      data
    }: {
      groupId: string;
      data: {
        name: string;
        color: string;
        type: 'income' | 'expense';
        categoryIds: string[];
      };
    }) => {
      const { error: groupError } = await supabase
        .from('categories')
        .update({
          name: data.name,
          color: data.color,
        })
        .eq('id', groupId);

      if (groupError) throw groupError;

      const { error: removeError } = await supabase
        .from('categories')
        .update({ parent_id: null })
        .eq('parent_id', groupId);

      if (removeError) throw removeError;

      if (data.categoryIds.length > 0) {
        const { error: updateError } = await supabase
          .from('categories')
          .update({ parent_id: groupId })
          .in('id', data.categoryIds);

        if (updateError) throw updateError;
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Groupe mis à jour');
    },
    onError: (error) => {
      logError('Error updating group:', error);
      toast.error('Erreur lors de la mise à jour du groupe');
    },
  });

  const updateGroup = async (
    groupId: string,
    data: {
      name: string;
      color: string;
      type: 'income' | 'expense';
      categoryIds: string[];
    }
  ) => {
    try {
      return await updateGroupMutation.mutateAsync({ groupId, data });
    } catch {
      return null;
    }
  };

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async ({ groupId, deleteChildren }: { groupId: string; deleteChildren: boolean }) => {
      if (deleteChildren) {
        const { error: childError } = await supabase
          .from('categories')
          .delete()
          .eq('parent_id', groupId);

        if (childError) throw childError;
      } else {
        const { error: unlinkError } = await supabase
          .from('categories')
          .update({ parent_id: null })
          .eq('parent_id', groupId);

        if (unlinkError) throw unlinkError;
      }

      const { error: groupError } = await supabase
        .from('categories')
        .delete()
        .eq('id', groupId);

      if (groupError) throw groupError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Groupe supprimé');
    },
    onError: (error) => {
      logError('Error deleting group:', error);
      toast.error('Erreur lors de la suppression du groupe');
    },
  });

  const deleteGroup = async (groupId: string, deleteChildren: boolean = false) => {
    try {
      await deleteGroupMutation.mutateAsync({ groupId, deleteChildren });
    } catch {
      // Error handled in mutation
    }
  };

  const isGroup = (categoryId: string) => {
    return categories.some(c => c.parent_id === categoryId);
  };

  // Bulk assign categories to a group
  const bulkAssignMutation = useMutation({
    mutationFn: async ({ categoryIds, groupId }: { categoryIds: string[]; groupId: string }) => {
      const { error } = await supabase
        .from('categories')
        .update({ parent_id: groupId })
        .in('id', categoryIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Catégories assignées au groupe');
    },
    onError: (error) => {
      logError('Error bulk assigning categories:', error);
      toast.error('Erreur lors de l\'assignation');
    },
  });

  const bulkAssignToGroup = async (categoryIds: string[], groupId: string) => {
    try {
      await bulkAssignMutation.mutateAsync({ categoryIds, groupId });
    } catch {
      // Error handled in mutation
    }
  };

  // Bulk remove categories from their groups
  const bulkRemoveMutation = useMutation({
    mutationFn: async (categoryIds: string[]) => {
      const { error } = await supabase
        .from('categories')
        .update({ parent_id: null })
        .in('id', categoryIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Catégories retirées du groupe');
    },
    onError: (error) => {
      logError('Error removing categories from group:', error);
      toast.error('Erreur lors du retrait');
    },
  });

  const bulkRemoveFromGroup = async (categoryIds: string[]) => {
    try {
      await bulkRemoveMutation.mutateAsync(categoryIds);
    } catch {
      // Error handled in mutation
    }
  };

  return {
    categories,
    incomeCategories,
    expenseCategories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    initializeDefaultCategories,
    refetch,
    getGroupedCategories,
    parentCategories,
    createGroup,
    updateGroup,
    deleteGroup,
    isGroup,
    bulkAssignToGroup,
    bulkRemoveFromGroup
  };
}
