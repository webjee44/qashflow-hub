import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompany } from './useCompany';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';
import { computeSpecificityScore } from '@/features/automations';

export interface RuleCondition {
  id?: string;
  rule_id?: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  created_at?: string;
}

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
  conditions?: RuleCondition[];
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
    if (!user || !currentCompany) return;
    
    try {
      // Strict company isolation
      const { data, error } = await supabase
        .from('automation_rules')
        .select(`
          *,
          category:categories(id, name, color)
        `)
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch conditions for all rules
      if (data && data.length > 0) {
        const ruleIds = data.map(r => r.id);
        const { data: conditions, error: conditionsError } = await supabase
          .from('automation_rule_conditions')
          .select('*')
          .in('rule_id', ruleIds);

        if (conditionsError) {
          logError('Error fetching conditions:', conditionsError);
        }

        // Group conditions by rule_id
        const conditionsByRule = new Map<string, RuleCondition[]>();
        for (const condition of (conditions || [])) {
          const ruleConditions = conditionsByRule.get(condition.rule_id) || [];
          ruleConditions.push(condition as RuleCondition);
          conditionsByRule.set(condition.rule_id, ruleConditions);
        }

        // Attach conditions to rules
        const rulesWithConditions = data.map(rule => ({
          ...rule,
          conditions: conditionsByRule.get(rule.id) || []
        }));

        setRules(rulesWithConditions);
      } else {
        setRules(data || []);
      }
      
      // Calculate stats
      const totalMatches = (data || []).reduce((acc, rule) => acc + (rule.match_count || 0), 0);
      setStats(prev => ({ ...prev, totalAutomated: totalMatches }));
    } catch (error) {
      logError('Error fetching rules:', error);
      toast.error('Erreur lors du chargement des règles');
    }
  };

  const fetchCategories = async () => {
    if (!user || !currentCompany) return;
    
    try {
      // Strict company isolation
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', currentCompany.id);

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      logError('Error fetching categories:', error);
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
        logError('Error applying rule:', error);
        return 0;
      }

      return data?.updated || 0;
    } catch (error) {
      logError('Error applying rule:', error);
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
    conditions?: RuleCondition[];
  }) => {
    if (!user || !currentCompany) return null;

    // Use owner's user_id for data consistency across members
    const dataOwnerId = currentCompany.user_id;

    try {
      // Anti-duplicate check before insert
      const { data: existing } = await supabase
        .from('automation_rules')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('condition_value', rule.condition_value)
        .eq('condition_operator', rule.condition_operator)
        .eq('target_category_id', rule.target_category_id || '')
        .eq('is_active', true)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.info('Cette règle existe déjà');
        return null;
      }

      // Create the rule
      const { data, error } = await supabase
        .from('automation_rules')
        .insert({
          name: rule.name,
          condition_field: rule.condition_field,
          condition_operator: rule.condition_operator,
          condition_value: rule.condition_value,
          action_type: rule.action_type,
          target_category_id: rule.target_category_id,
          user_id: dataOwnerId,
          company_id: currentCompany.id,
          is_active: true,
          match_count: 0
        })
        .select(`
          *,
          category:categories(id, name, color)
        `)
        .single();

      if (error) throw error;

      // Create conditions in the new table
      const conditions = rule.conditions || [
        {
          condition_field: rule.condition_field as 'description' | 'amount' | 'type',
          condition_operator: rule.condition_operator,
          condition_value: rule.condition_value
        }
      ];

      const conditionsToInsert = conditions.map(c => ({
        rule_id: data.id,
        condition_field: c.condition_field,
        condition_operator: c.condition_operator,
        condition_value: c.condition_value
      }));

      const { data: insertedConditions, error: conditionsError } = await supabase
        .from('automation_rule_conditions')
        .insert(conditionsToInsert)
        .select();

      if (conditionsError) {
        logError('Error creating conditions:', conditionsError);
        throw conditionsError;
      }

      const ruleWithConditions = {
        ...data,
        conditions: insertedConditions || conditions
      };

      setRules(prev => [ruleWithConditions, ...prev]);
      
      // Apply immediately to existing transactions
      const updated = await applyRuleToExistingTransactions(data.id);
      if (updated > 0) {
        toast.success(`Règle créée - ${updated} transaction${updated > 1 ? 's' : ''} catégorisée${updated > 1 ? 's' : ''}`);
        // Update match_count locally
        setRules(prev => prev.map(r => 
          r.id === data.id ? { ...r, match_count: updated } : r
        ));
      } else {
        toast.success('Règle créée avec succès');
      }
      
      return ruleWithConditions;
    } catch (error) {
      logError('Error creating rule:', error);
      toast.error('Erreur lors de la création de la règle');
      return null;
    }
  };

  const createCategory = async (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
  }) => {
    if (!user || !currentCompany) return null;

    // Use owner's user_id for data consistency across members
    const dataOwnerId = currentCompany.user_id;

    try {
      const { data: newCategory, error } = await supabase
        .from('categories')
        .insert({
          ...data,
          user_id: dataOwnerId,
          company_id: currentCompany.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, newCategory]);
      toast.success('Catégorie créée avec succès');
      return newCategory;
    } catch (error) {
      logError('Error creating category:', error);
      toast.error('Erreur lors de la création de la catégorie');
      return null;
    }
  };

  const updateRule = async (id: string, updates: Partial<AutomationRule> & { conditions?: RuleCondition[] }) => {
    try {
      // Separate conditions from rule updates
      const { conditions, ...ruleUpdates } = updates;

      // Update the rule itself
      const { data, error } = await supabase
        .from('automation_rules')
        .update(ruleUpdates)
        .eq('id', id)
        .select(`
          *,
          category:categories(id, name, color)
        `)
        .single();

      if (error) throw error;

      let ruleWithConditions = { ...data, conditions: [] as RuleCondition[] };

      // Update conditions if provided
      if (conditions) {
        // Delete existing conditions
        await supabase
          .from('automation_rule_conditions')
          .delete()
          .eq('rule_id', id);

        // Insert new conditions
        if (conditions.length > 0) {
          const conditionsToInsert = conditions.map(c => ({
            rule_id: id,
            condition_field: c.condition_field,
            condition_operator: c.condition_operator,
            condition_value: c.condition_value
          }));

          const { data: insertedConditions, error: conditionsError } = await supabase
            .from('automation_rule_conditions')
            .insert(conditionsToInsert)
            .select();

          if (conditionsError) {
            logError('Error updating conditions:', conditionsError);
            throw conditionsError;
          }

          ruleWithConditions = {
            ...data,
            conditions: insertedConditions || conditions
          };
        }
      }

      setRules(prev => prev.map(r => r.id === id ? ruleWithConditions : r));

      // Re-apply the rule to existing transactions after update
      const updated = await applyRuleToExistingTransactions(id);
      if (updated > 0) {
        toast.success(`Règle mise à jour - ${updated} transaction${updated > 1 ? 's' : ''} catégorisée${updated > 1 ? 's' : ''}`);
        // Update match_count locally
        setRules(prev => prev.map(r => 
          r.id === id ? { ...r, match_count: (r.match_count || 0) + updated } : r
        ));
      } else {
        toast.success('Règle mise à jour');
      }
      
      return ruleWithConditions;
    } catch (error) {
      logError('Error updating rule:', error);
      toast.error('Erreur lors de la mise à jour');
      return null;
    }
  };

  const toggleRule = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    
    const newState = !rule.is_active;
    await updateRule(id, { is_active: newState });
    
    // If activating the rule, apply to existing transactions
    if (newState) {
      const updated = await applyRuleToExistingTransactions(id);
      if (updated > 0) {
        toast.success(`${updated} transaction${updated > 1 ? 's' : ''} catégorisée${updated > 1 ? 's' : ''}`);
        // Update match_count locally
        setRules(prev => prev.map(r => 
          r.id === id ? { ...r, match_count: (r.match_count || 0) + updated } : r
        ));
      }
    }
  };

  const deleteRule = async (id: string, decategorize = false) => {
    try {
      // Optionally decategorize matching transactions before deleting
      let decategorized = 0;
      if (decategorize) {
        const { data, error: decatError } = await supabase.functions.invoke('decategorize-rule-transactions', {
          body: { rule_id: id }
        });
        if (decatError) {
          logError('Error decategorizing transactions:', decatError);
        } else {
          decategorized = data?.decategorized || 0;
        }
      }

      // Conditions will be deleted automatically due to CASCADE
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setRules(prev => prev.filter(r => r.id !== id));
      if (decategorized > 0) {
        toast.success(`Règle supprimée — ${decategorized} transaction${decategorized > 1 ? 's' : ''} décatégorisée${decategorized > 1 ? 's' : ''}`);
      } else {
        toast.success('Règle supprimée');
      }
    } catch (error) {
      logError('Error deleting rule:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return {
    rules,
    categories,
    loading,
    stats,
    createRule,
    createCategory,
    updateRule,
    toggleRule,
    deleteRule,
    applyRuleToExistingTransactions,
    refetch: fetchRules
  };
}
