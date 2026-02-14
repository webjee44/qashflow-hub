import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';

export function useBPDemoData() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  const { data: hasDemoData = false, isLoading } = useQuery({
    queryKey: ['bp_demo_data', companyId],
    queryFn: async () => {
      if (!companyId) return false;
      // Check if any demo revenue stream exists for this company
      const { count } = await supabase
        .from('bp_revenue_streams')
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

      // Delete demo forecasts first (FK on stream_id)
      const { data: demoStreams } = await supabase
        .from('bp_revenue_streams')
        .select('id')
        .eq('company_id', companyId)
        .eq('is_demo', true);

      if (demoStreams && demoStreams.length > 0) {
        const streamIds = demoStreams.map((s) => s.id);
        await supabase
          .from('bp_revenue_forecasts')
          .delete()
          .in('stream_id', streamIds)
          .eq('is_demo', true);
      }

      // Delete demo data from all tables
      await Promise.all([
        supabase.from('bp_revenue_streams').delete().eq('company_id', companyId).eq('is_demo', true),
        supabase.from('bp_fixed_expenses').delete().eq('company_id', companyId).eq('is_demo', true),
        supabase.from('bp_personnel').delete().eq('company_id', companyId).eq('is_demo', true),
        supabase.from('bp_investments').delete().eq('company_id', companyId).eq('is_demo', true),
      ]);

      // Mark as cleared so we don't re-seed
      if (companyId) {
        localStorage.setItem(`bp-demo-seeded-${companyId}`, 'cleared');
      }
    },
    onSuccess: () => {
      toast.success('Données de démonstration supprimées');
      // Invalidate all BP queries
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams'] });
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_forecasts'] });
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses'] });
      queryClient.invalidateQueries({ queryKey: ['bp_personnel'] });
      queryClient.invalidateQueries({ queryKey: ['bp_investments'] });
      queryClient.invalidateQueries({ queryKey: ['bp_demo_data'] });
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
