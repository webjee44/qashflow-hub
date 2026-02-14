import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';

export function useForecastDemoData() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  const { data: hasDemoData = false, isLoading } = useQuery({
    queryKey: ['forecast_demo_data', companyId],
    queryFn: async () => {
      if (!companyId) return false;
      const { count } = await supabase
        .from('category_forecasts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_demo', true);
      return (count ?? 0) > 0;
    },
    enabled: !!companyId,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No company');

      const { error } = await supabase
        .from('category_forecasts')
        .delete()
        .eq('company_id', companyId)
        .eq('is_demo', true);

      if (error) throw error;

      localStorage.setItem(`forecast-demo-seeded-${companyId}`, 'cleared');
    },
    onSuccess: () => {
      toast.success('Données de démonstration supprimées');
      queryClient.invalidateQueries({ queryKey: ['category-forecasts'] });
      queryClient.invalidateQueries({ queryKey: ['forecast_demo_data'] });
    },
    onError: () => {
      toast.error('Erreur lors de la suppression des données de démo');
    },
  });

  return {
    hasDemoData,
    isLoading,
    clearDemoData: clearMutation.mutate,
    isClearing: clearMutation.isPending,
  };
}
