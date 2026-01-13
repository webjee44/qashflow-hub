import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export interface Scenario {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  revenue_multiplier: number;
  expense_multiplier: number;
  is_default: boolean;
  color: string | null;
  icon: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SCENARIOS = [
  { name: 'Pessimiste', revenue_multiplier: 0.7, expense_multiplier: 1.2, color: 'hsl(0, 70%, 50%)', icon: 'TrendingDown' },
  { name: 'Réaliste', revenue_multiplier: 1.0, expense_multiplier: 1.0, color: 'hsl(220, 70%, 50%)', icon: 'Target' },
  { name: 'Optimiste', revenue_multiplier: 1.3, expense_multiplier: 0.9, color: 'hsl(142, 70%, 45%)', icon: 'TrendingUp' },
];

export function useScenarios() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch scenarios
  const { data: scenarios = [], isLoading, refetch } = useQuery({
    queryKey: ['bp_scenarios', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('bp_scenarios')
        .select('*')
        .order('created_at', { ascending: true });

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Scenario[];
    },
    enabled: !!user,
  });

  // Initialize default scenarios if none exist
  useEffect(() => {
    const initDefaults = async () => {
      if (!user || isLoading || scenarios.length > 0) return;

      try {
        const { error } = await supabase
          .from('bp_scenarios')
          .insert(
            DEFAULT_SCENARIOS.map(s => ({
              user_id: user.id,
              company_id: currentCompany?.id || null,
              name: s.name,
              revenue_multiplier: s.revenue_multiplier,
              expense_multiplier: s.expense_multiplier,
              color: s.color,
              icon: s.icon,
              is_default: true,
            }))
          );

        if (!error) {
          refetch();
        }
      } catch (err) {
        console.error('Error initializing default scenarios:', err);
      }
    };

    initDefaults();
  }, [user, currentCompany?.id, isLoading, scenarios.length, refetch]);

  // Create scenario mutation
  const createScenario = useMutation({
    mutationFn: async (data: Partial<Scenario>) => {
      if (!user) throw new Error('Not authenticated');

      const { data: newScenario, error } = await supabase
        .from('bp_scenarios')
        .insert({
          user_id: user.id,
          company_id: currentCompany?.id || null,
          name: data.name || 'Nouveau scénario',
          revenue_multiplier: data.revenue_multiplier ?? 1.0,
          expense_multiplier: data.expense_multiplier ?? 1.0,
          color: data.color || 'hsl(200, 70%, 50%)',
          icon: data.icon || 'Sparkles',
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;
      return newScenario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_scenarios'] });
      toast({ title: 'Scénario créé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Update scenario mutation
  const updateScenario = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Scenario> & { id: string }) => {
      const { error } = await supabase
        .from('bp_scenarios')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_scenarios'] });
      toast({ title: 'Scénario mis à jour' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Delete scenario mutation (only non-default)
  const deleteScenario = useMutation({
    mutationFn: async (id: string) => {
      const scenario = scenarios.find(s => s.id === id);
      if (scenario?.is_default) {
        throw new Error('Les scénarios par défaut ne peuvent pas être supprimés');
      }

      const { error } = await supabase
        .from('bp_scenarios')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_scenarios'] });
      toast({ title: 'Scénario supprimé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Helper: apply scenario multipliers to a value
  const applyScenario = (scenario: Scenario, revenue: number, expenses: number) => {
    return {
      revenue: revenue * Number(scenario.revenue_multiplier),
      expenses: expenses * Number(scenario.expense_multiplier),
      result: (revenue * Number(scenario.revenue_multiplier)) - (expenses * Number(scenario.expense_multiplier)),
    };
  };

  return {
    scenarios,
    isLoading,
    createScenario,
    updateScenario,
    deleteScenario,
    applyScenario,
  };
}
