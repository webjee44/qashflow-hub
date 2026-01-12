import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { toast } from 'sonner';

export interface AutomationRule {
  id: string;
  name: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  action_type: string;
  target_category_id: string | null;
  is_active: boolean;
  match_count: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  company_id?: string | null;
  category?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'income' | 'expense';
}

export function useAutomationRules() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAutomated: 0,
    accuracy: 96,
    timeSaved: '12h'
  });

  const fetchRules = async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('automation_rules')
        .select(`
          *,
          category:categories(id, name, color)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Filter by company if one is selected
      if (currentCompany) {
        query = query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRules(data || []);
      
      // Calculate stats
      const totalMatches = (data || []).reduce((acc, rule) => acc + (rule.match_count || 0), 0);
      setStats(prev => ({ ...prev, totalAutomated: totalMatches }));
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Erreur lors du chargement des règles');
    }
  };

  const fetchCategories = async () => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);

      // Filter by company if one is selected
      if (currentCompany) {
        query = query.or(`company_id.eq.${currentCompany.id},company_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRules(), fetchCategories()]);
      setLoading(false);
    };
    
    if (user) {
      loadData();
    }
  }, [user, currentCompany]);

  const applyRuleToExistingTransactions = async (ruleId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('apply-automation-rule', {
        body: { rule_id: ruleId, company_id: currentCompany?.id }
      });

      if (error) {
        console.error('Error applying rule:', error);
        return 0;
      }

      return data?.updated || 0;
    } catch (error) {
      console.error('Error applying rule:', error);
      return 0;
    }
  };

  const createRule = async (rule: {
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    action_type: string;
    target_category_id: string | null;
  }) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .insert({
          ...rule,
          user_id: user.id,
          company_id: currentCompany?.id || null,
          is_active: true,
          match_count: 0
        })
        .select(`
          *,
          category:categories(id, name, color)
        `)
        .single();

      if (error) throw error;
      
      setRules(prev => [data, ...prev]);
      
      // Appliquer immédiatement aux transactions existantes
      const updated = await applyRuleToExistingTransactions(data.id);
      if (updated > 0) {
        toast.success(`Règle créée - ${updated} transaction${updated > 1 ? 's' : ''} catégorisée${updated > 1 ? 's' : ''}`);
        // Mettre à jour le match_count localement
        setRules(prev => prev.map(r => 
          r.id === data.id ? { ...r, match_count: updated } : r
        ));
      } else {
        toast.success('Règle créée avec succès');
      }
      
      return data;
    } catch (error) {
      console.error('Error creating rule:', error);
      toast.error('Erreur lors de la création de la règle');
      return null;
    }
  };

  const updateRule = async (id: string, updates: Partial<AutomationRule>) => {
    try {
      const { data, error } = await supabase
        .from('automation_rules')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          category:categories(id, name, color)
        `)
        .single();

      if (error) throw error;
      
      setRules(prev => prev.map(r => r.id === id ? data : r));
      toast.success('Règle mise à jour');
      return data;
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Erreur lors de la mise à jour');
      return null;
    }
  };

  const toggleRule = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    
    const newState = !rule.is_active;
    await updateRule(id, { is_active: newState });
    
    // Si on active la règle, l'appliquer aux transactions existantes
    if (newState) {
      const updated = await applyRuleToExistingTransactions(id);
      if (updated > 0) {
        toast.success(`${updated} transaction${updated > 1 ? 's' : ''} catégorisée${updated > 1 ? 's' : ''}`);
        // Mettre à jour le match_count localement
        setRules(prev => prev.map(r => 
          r.id === id ? { ...r, match_count: (r.match_count || 0) + updated } : r
        ));
      }
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setRules(prev => prev.filter(r => r.id !== id));
      toast.success('Règle supprimée');
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return {
    rules,
    categories,
    loading,
    stats,
    createRule,
    updateRule,
    toggleRule,
    deleteRule,
    refetch: fetchRules
  };
}
