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
  sort_order?: number;
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

// Fetch function for categories - strict company isolation
async function fetchCategories(companyId?: string | null): Promise<Category[]> {
  if (!companyId) return [];
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function useCategories() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const companyId = currentCompany?.id;
  const queryKey = ['categories', companyId];

  // Main query with React Query caching - strict company isolation
  const { data: categories = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchCategories(companyId),
    enabled: !!user && !!companyId,
    staleTime: 1000 * 60 * 10, // 10 minutes cache for categories
  });

  const initializeDefaultCategories = async () => {
    if (!user || !currentCompany) return;
    
    // Use owner's user_id for data consistency
    const dataOwnerId = currentCompany.user_id;
    
    try {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('company_id', currentCompany.id)
        .limit(1);

      if (existing && existing.length > 0) return;

      const categoriesToInsert = defaultCategories.map(cat => ({
        ...cat,
        user_id: dataOwnerId,
        company_id: currentCompany.id
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
      parent_id?: string | null;
    }) => {
      if (!user || !currentCompany) throw new Error('User not authenticated or no company');
      
      // Use owner's user_id for data consistency across members
      const dataOwnerId = currentCompany.user_id;
      
      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...category,
          vat_rate: category.vat_rate ?? 0,
          parent_id: category.parent_id ?? null,
          user_id: dataOwnerId,
          company_id: currentCompany.id
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
    parent_id?: string | null;
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

    // First pass: identify children
    typeCats.forEach(cat => {
      if (cat.parent_id) {
        const existing = childrenByParent.get(cat.parent_id) || [];
        existing.push(cat);
        childrenByParent.set(cat.parent_id, existing);
      }
    });

    // Second pass: separate groups from regular categories
    // A category is a group if:
    // - It has children, OR
    // - It was created as a group (icon === 'Folder' and no parent_id)
    typeCats.forEach(cat => {
      if (!cat.parent_id) {
        const hasChildren = childrenByParent.has(cat.id);
        const isGroupByIcon = cat.icon === 'Folder';
        
        if (hasChildren || isGroupByIcon) {
          // This is a group (with or without children)
          // Sort children by sort_order then name
          const children = childrenByParent.get(cat.id) || [];
          children.sort((a, b) => {
            const orderA = a.sort_order ?? 0;
            const orderB = b.sort_order ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
          });
          groups.push({
            group: cat,
            children
          });
        } else {
          // Regular ungrouped category
          topLevelCats.push(cat);
        }
      }
    });

    // Sort ungrouped by sort_order then name
    topLevelCats.sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    if (topLevelCats.length > 0) {
      groups.unshift({
        group: null,
        children: topLevelCats
      });
    }

    // Sort groups by sort_order then name
    return groups.sort((a, b) => {
      if (!a.group) return -1;
      if (!b.group) return 1;
      const orderA = a.group.sort_order ?? 0;
      const orderB = b.group.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
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
      if (!user || !currentCompany) throw new Error('User not authenticated or no company');

      // Use owner's user_id for data consistency across members
      const dataOwnerId = currentCompany.user_id;

      const { data: groupData, error: groupError } = await supabase
        .from('categories')
        .insert({
          name: data.name,
          color: data.color,
          icon: 'Folder',
          type: data.type,
          vat_rate: 0,
          user_id: dataOwnerId,
          company_id: currentCompany.id,
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

  // Reorder categories mutation
  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number; parent_id?: string | null }[]) => {
      // Batch update all sort_orders
      const promises = updates.map(({ id, sort_order, parent_id }) => {
        const updateData: { sort_order: number; parent_id?: string | null } = { sort_order };
        if (parent_id !== undefined) {
          updateData.parent_id = parent_id;
        }
        return supabase
          .from('categories')
          .update(updateData)
          .eq('id', id);
      });

      const results = await Promise.all(promises);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      logError('Error reordering categories:', error);
      toast.error('Erreur lors du réordonnancement');
    },
  });

  const reorderCategories = async (
    itemId: string,
    targetId: string,
    position: 'before' | 'after',
    targetParentId: string | null
  ) => {
    // Get the item being moved
    const item = categories.find(c => c.id === itemId);
    if (!item) return;

    // Get the target item
    const target = categories.find(c => c.id === targetId);
    if (!target) return;

    // Get all items at the target level (same parent_id), INCLUDING the target
    const allAtLevel = categories.filter(c => 
      c.type === item.type && 
      c.parent_id === targetParentId
    );

    // Remove the item being moved from this list (if it's there)
    const siblings = allAtLevel.filter(c => c.id !== itemId);

    // Sort by current sort_order
    siblings.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    // Find target index in the filtered list
    const targetIndex = siblings.findIndex(c => c.id === targetId);
    
    if (targetIndex === -1) {
      // Target not found at this level, just append
      siblings.push(item);
    } else {
      // Insert at correct position
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      siblings.splice(insertIndex, 0, item);
    }

    // Build updates with new sort_order values
    const updates = siblings.map((cat, index) => ({
      id: cat.id,
      sort_order: index,
      // Only update parent_id for the moved item
      parent_id: cat.id === itemId ? targetParentId : undefined
    }));

    try {
      await reorderMutation.mutateAsync(updates);
      toast.success('Ordre mis à jour');
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
    bulkRemoveFromGroup,
    reorderCategories
  };
}
