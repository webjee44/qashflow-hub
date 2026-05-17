import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';
import { categoryApi } from '../api/categoryApi';

import type { StoredCashFlowBucket } from '@/features/treasury/types/treasuryActuals';

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
  forecast_mode?: 'manual' | 'percent_of_revenue';
  forecast_percent?: number;
  is_system?: boolean;
  /** True for the system "TVA à payer" category (one per company). */
  is_vat_payment?: boolean;
  /** Cash-flow bucket used by the Treasury engine. Nullable → routed to uncategorized_*. */
  cash_flow_bucket?: StoredCashFlowBucket | null;
  /** How the bucket was assigned: 'system' (backfill) or 'suggested' (heuristic). */
  cash_flow_bucket_confidence?: 'system' | 'suggested' | null;
}

export const SYSTEM_CATEGORY_INTERCOMPTE = 'Virement intercompte';

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

export function useCategories() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const companyId = currentCompany?.id;
  const queryKey = ['categories', companyId];

  const { data: categories = [], isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await categoryApi.getByCompany(companyId!);
      return data as Category[];
    },
    enabled: !!user && !!companyId,
    staleTime: 1000 * 60 * 10,
  });

  // Ensure system categories exist whenever categories are loaded
  const ensureSystemCategories = async () => {
    if (!user || !currentCompany) return;
    const hasIntercompte = categories.some(c => c.name === SYSTEM_CATEGORY_INTERCOMPTE);
    if (hasIntercompte) return;

    try {
      await categoryApi.create({
        name: SYSTEM_CATEGORY_INTERCOMPTE,
        color: 'hsl(220, 14%, 60%)',
        icon: 'ArrowLeftRight',
        type: 'expense',
        vat_rate: 0,
        is_system: true,
        user_id: currentCompany.user_id,
        company_id: currentCompany.id,
      });
      queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      logError('Error creating system category:', error);
    }
  };

  // Auto-ensure system categories when categories are loaded
  useEffect(() => {
    if (!loading && categories.length > 0 && user && currentCompany) {
      const hasIntercompte = categories.some(c => c.name === SYSTEM_CATEGORY_INTERCOMPTE);
      if (!hasIntercompte) {
        ensureSystemCategories();
      }
    }
  }, [loading, categories.length, user?.id, currentCompany?.id]);

  const initializeDefaultCategories = async () => {
    if (!user || !currentCompany) return;
    const dataOwnerId = currentCompany.user_id;

    try {
      const exists = await categoryApi.checkExists(currentCompany.id);
      if (exists) return;

      const categoriesToInsert = defaultCategories.map(cat => ({
        ...cat,
        user_id: dataOwnerId,
        company_id: currentCompany.id,
      }));

      await categoryApi.insertMany(categoriesToInsert);
      queryClient.invalidateQueries({ queryKey });
      toast.success('Catégories par défaut créées');
    } catch (error) {
      logError('Error initializing categories:', error);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (category: {
      name: string;
      color: string;
      icon: string;
      type: 'income' | 'expense';
      vat_rate?: number;
      parent_id?: string | null;
      forecast_mode?: 'manual' | 'percent_of_revenue';
      forecast_percent?: number;
    }) => {
      if (!user || !currentCompany) throw new Error('User not authenticated or no company');
      return categoryApi.create({
        ...category,
        user_id: currentCompany.user_id,
        company_id: currentCompany.id,
      });
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
    forecast_mode?: 'manual' | 'percent_of_revenue';
    forecast_percent?: number;
  }) => {
    try {
      return await createMutation.mutateAsync(category);
    } catch {
      return null;
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Category> }) => {
      return categoryApi.update(id, updates as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // A category update can purge stale manual overrides when switching to
      // percent_of_revenue mode — keep the forecast view in sync.
      queryClient.invalidateQueries({ queryKey: ['category-forecasts'] });
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

  const deleteMutation = useMutation({
    mutationFn: async ({ id, reassignToId }: { id: string; reassignToId?: string | null }) => {
      if (reassignToId) {
        await categoryApi.reassignTransactions(id, reassignToId);
      }
      await categoryApi.delete(id);
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
    const cat = categories.find(c => c.id === id);
    if (cat?.is_system) {
      toast.error('Les catégories système ne peuvent pas être supprimées');
      return;
    }
    try {
      await deleteMutation.mutateAsync({ id, reassignToId });
    } catch {
      // Error handled in mutation
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const parentCategories = (type: 'income' | 'expense') => {
    const typeCats = type === 'income' ? incomeCategories : expenseCategories;
    const parentIds = new Set(typeCats.filter(c => c.parent_id).map(c => c.parent_id));
    return typeCats.filter(c => parentIds.has(c.id));
  };

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
        const hasChildren = childrenByParent.has(cat.id);
        const isGroupByIcon = cat.icon === 'Folder';

        if (hasChildren || isGroupByIcon) {
          const children = childrenByParent.get(cat.id) || [];
          children.sort((a, b) => {
            const orderA = a.sort_order ?? 0;
            const orderB = b.sort_order ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
          });
          groups.push({ group: cat, children });
        } else {
          topLevelCats.push(cat);
        }
      }
    });

    topLevelCats.sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    if (topLevelCats.length > 0) {
      groups.unshift({ group: null, children: topLevelCats });
    }

    return groups.sort((a, b) => {
      if (!a.group) return -1;
      if (!b.group) return 1;
      const orderA = a.group.sort_order ?? 0;
      const orderB = b.group.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.group.name.localeCompare(b.group.name);
    });
  };

  const createGroupMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      color: string;
      type: 'income' | 'expense';
      categoryIds: string[];
    }) => {
      if (!user || !currentCompany) throw new Error('User not authenticated or no company');

      const groupData = await categoryApi.create({
        name: data.name,
        color: data.color,
        icon: 'Folder',
        type: data.type,
        vat_rate: 0,
        user_id: currentCompany.user_id,
        company_id: currentCompany.id,
        parent_id: null,
      });

      if (data.categoryIds.length > 0) {
        await categoryApi.updateParent(data.categoryIds, groupData.id);
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

  const updateGroupMutation = useMutation({
    mutationFn: async ({
      groupId,
      data,
    }: {
      groupId: string;
      data: {
        name: string;
        color: string;
        type: 'income' | 'expense';
        categoryIds: string[];
      };
    }) => {
      await categoryApi.update(groupId, { name: data.name, color: data.color });
      await categoryApi.clearParent(groupId);

      if (data.categoryIds.length > 0) {
        await categoryApi.updateParent(data.categoryIds, groupId);
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

  const deleteGroupMutation = useMutation({
    mutationFn: async ({ groupId, deleteChildren }: { groupId: string; deleteChildren: boolean }) => {
      if (deleteChildren) {
        await categoryApi.deleteByParent(groupId);
      } else {
        await categoryApi.clearParent(groupId);
      }
      await categoryApi.delete(groupId);
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

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ categoryIds, groupId }: { categoryIds: string[]; groupId: string }) => {
      await categoryApi.updateParent(categoryIds, groupId);
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

  const bulkRemoveMutation = useMutation({
    mutationFn: async (categoryIds: string[]) => {
      await categoryApi.updateParent(categoryIds, null);
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

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number; parent_id?: string | null }[]) => {
      const promises = updates.map(({ id, sort_order, parent_id }) =>
        categoryApi.updateSortOrder(id, sort_order, parent_id)
      );
      await Promise.all(promises);
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
    const item = categories.find(c => c.id === itemId);
    if (!item) return;

    const target = categories.find(c => c.id === targetId);
    if (!target) return;

    const allAtLevel = categories.filter(c =>
      c.type === item.type &&
      c.parent_id === targetParentId
    );

    const siblings = allAtLevel.filter(c => c.id !== itemId);
    siblings.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const targetIndex = siblings.findIndex(c => c.id === targetId);

    if (targetIndex === -1) {
      siblings.push(item);
    } else {
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      siblings.splice(insertIndex, 0, item);
    }

    const updates = siblings.map((cat, index) => ({
      id: cat.id,
      sort_order: index,
      parent_id: cat.id === itemId ? targetParentId : undefined,
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
    reorderCategories,
  };
}
