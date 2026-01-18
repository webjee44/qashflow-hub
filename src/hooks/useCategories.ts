import { useState, useEffect } from 'react';
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

export function useCategories() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('type', { ascending: true })
        .order('name', { ascending: true });

      // Filter by company if one is selected
      if (currentCompany) {
        query = query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      logError('Error fetching categories:', error);
      toast.error('Erreur lors du chargement des catégories');
    } finally {
      setLoading(false);
    }
  };

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
      
      await fetchCategories();
      toast.success('Catégories par défaut créées');
    } catch (error) {
      logError('Error initializing categories:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user, currentCompany]);

  const createCategory = async (category: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
    vat_rate?: number;
  }) => {
    if (!user) return null;

    try {
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
      
      setCategories(prev => [...prev, data]);
      toast.success('Catégorie créée avec succès');
      return data;
    } catch (error) {
      logError('Error creating category:', error);
      toast.error('Erreur lors de la création');
      return null;
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setCategories(prev => prev.map(c => c.id === id ? data : c));
      toast.success('Catégorie mise à jour');
      return data;
    } catch (error) {
      logError('Error updating category:', error);
      toast.error('Erreur lors de la mise à jour');
      return null;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setCategories(prev => prev.filter(c => c.id !== id));
      toast.success('Catégorie supprimée');
    } catch (error) {
      logError('Error deleting category:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Get only parent/group categories (categories with no parent_id that have children)
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

    // First pass: identify children and their parents
    typeCats.forEach(cat => {
      if (cat.parent_id) {
        const existing = childrenByParent.get(cat.parent_id) || [];
        existing.push(cat);
        childrenByParent.set(cat.parent_id, existing);
      }
    });

    // Second pass: categorize
    typeCats.forEach(cat => {
      if (!cat.parent_id) {
        // This is a top-level category
        if (childrenByParent.has(cat.id)) {
          // It's a parent with children
          groups.push({
            group: cat,
            children: childrenByParent.get(cat.id)!.sort((a, b) => a.name.localeCompare(b.name))
          });
        } else {
          // It's a standalone category
          topLevelCats.push(cat);
        }
      }
    });

    // Add standalone categories as a "no group" section
    if (topLevelCats.length > 0) {
      groups.unshift({
        group: null,
        children: topLevelCats.sort((a, b) => a.name.localeCompare(b.name))
      });
    }

    // Sort groups by name
    return groups.sort((a, b) => {
      if (!a.group) return -1;
      if (!b.group) return 1;
      return a.group.name.localeCompare(b.group.name);
    });
  };
  // Create a group with selected categories
  const createGroup = async (data: {
    name: string;
    color: string;
    type: 'income' | 'expense';
    categoryIds: string[];
  }) => {
    if (!user) return null;

    try {
      // 1. Create the group category
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

      // 2. Update selected categories to belong to this group
      if (data.categoryIds.length > 0) {
        const { error: updateError } = await supabase
          .from('categories')
          .update({ parent_id: groupData.id })
          .in('id', data.categoryIds);

        if (updateError) throw updateError;
      }

      await fetchCategories();
      toast.success('Groupe créé avec succès');
      return groupData;
    } catch (error) {
      logError('Error creating group:', error);
      toast.error('Erreur lors de la création du groupe');
      return null;
    }
  };

  // Update an existing group
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
      // 1. Update the group itself
      const { error: groupError } = await supabase
        .from('categories')
        .update({
          name: data.name,
          color: data.color,
        })
        .eq('id', groupId);

      if (groupError) throw groupError;

      // 2. Remove all categories from this group first
      const { error: removeError } = await supabase
        .from('categories')
        .update({ parent_id: null })
        .eq('parent_id', groupId);

      if (removeError) throw removeError;

      // 3. Add selected categories to this group
      if (data.categoryIds.length > 0) {
        const { error: updateError } = await supabase
          .from('categories')
          .update({ parent_id: groupId })
          .in('id', data.categoryIds);

        if (updateError) throw updateError;
      }

      await fetchCategories();
      toast.success('Groupe mis à jour');
      return true;
    } catch (error) {
      logError('Error updating group:', error);
      toast.error('Erreur lors de la mise à jour du groupe');
      return null;
    }
  };

  // Delete a group (optionally keeping or deleting children)
  const deleteGroup = async (groupId: string, deleteChildren: boolean = false) => {
    try {
      if (deleteChildren) {
        // Delete all children first
        const { error: childError } = await supabase
          .from('categories')
          .delete()
          .eq('parent_id', groupId);

        if (childError) throw childError;
      } else {
        // Unlink children (set parent_id to null)
        const { error: unlinkError } = await supabase
          .from('categories')
          .update({ parent_id: null })
          .eq('parent_id', groupId);

        if (unlinkError) throw unlinkError;
      }

      // Delete the group
      const { error: groupError } = await supabase
        .from('categories')
        .delete()
        .eq('id', groupId);

      if (groupError) throw groupError;

      await fetchCategories();
      toast.success('Groupe supprimé');
    } catch (error) {
      logError('Error deleting group:', error);
      toast.error('Erreur lors de la suppression du groupe');
    }
  };

  // Check if a category is a group (has children)
  const isGroup = (categoryId: string) => {
    return categories.some(c => c.parent_id === categoryId);
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
    refetch: fetchCategories,
    getGroupedCategories,
    parentCategories,
    createGroup,
    updateGroup,
    deleteGroup,
    isGroup
  };
}
