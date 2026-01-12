import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { toast } from 'sonner';

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
      console.error('Error fetching categories:', error);
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
      console.error('Error initializing categories:', error);
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
      console.error('Error creating category:', error);
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
      console.error('Error updating category:', error);
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
      console.error('Error deleting category:', error);
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
    parentCategories
  };
}
