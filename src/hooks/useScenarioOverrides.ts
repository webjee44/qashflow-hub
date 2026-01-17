import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type ItemType = 'revenue_stream' | 'fixed_expense' | 'variable_expense' | 'personnel' | 'investment';
export type OverrideType = 'multiplier' | 'fixed_value' | 'disabled';

export interface ScenarioOverride {
  id: string;
  scenario_id: string;
  user_id: string;
  item_type: ItemType;
  item_id: string;
  override_type: OverrideType;
  override_value: number | null;
  created_at: string;
  updated_at: string;
}

export function useScenarioOverrides(scenarioId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch overrides for a scenario
  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ['bp_scenario_overrides', scenarioId],
    queryFn: async () => {
      if (!scenarioId) return [];

      const { data, error } = await supabase
        .from('bp_scenario_overrides')
        .select('*')
        .eq('scenario_id', scenarioId);

      if (error) throw error;
      return (data || []) as ScenarioOverride[];
    },
    enabled: !!user && !!scenarioId,
  });

  // Set override (create or update)
  const setOverride = useMutation({
    mutationFn: async ({
      scenarioId,
      itemType,
      itemId,
      overrideType,
      overrideValue,
    }: {
      scenarioId: string;
      itemType: ItemType;
      itemId: string;
      overrideType: OverrideType;
      overrideValue?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bp_scenario_overrides')
        .upsert({
          scenario_id: scenarioId,
          user_id: user.id,
          item_type: itemType,
          item_id: itemId,
          override_type: overrideType,
          override_value: overrideValue ?? null,
        }, {
          onConflict: 'scenario_id,item_type,item_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_scenario_overrides'] });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Remove override
  const removeOverride = useMutation({
    mutationFn: async ({
      scenarioId,
      itemType,
      itemId,
    }: {
      scenarioId: string;
      itemType: ItemType;
      itemId: string;
    }) => {
      const { error } = await supabase
        .from('bp_scenario_overrides')
        .delete()
        .eq('scenario_id', scenarioId)
        .eq('item_type', itemType)
        .eq('item_id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_scenario_overrides'] });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Helper: get override for a specific item
  const getOverride = (itemType: ItemType, itemId: string): ScenarioOverride | undefined => {
    return overrides.find(o => o.item_type === itemType && o.item_id === itemId);
  };

  // Helper: apply override to a value
  const applyOverride = (itemType: ItemType, itemId: string, originalValue: number): number => {
    const override = getOverride(itemType, itemId);
    if (!override) return originalValue;

    switch (override.override_type) {
      case 'multiplier':
        return originalValue * (override.override_value || 1);
      case 'fixed_value':
        return override.override_value || 0;
      case 'disabled':
        return 0;
      default:
        return originalValue;
    }
  };

  return {
    overrides,
    isLoading,
    setOverride,
    removeOverride,
    getOverride,
    applyOverride,
  };
}
