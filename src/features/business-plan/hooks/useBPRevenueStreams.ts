// ============================================
// useBPRevenueStreams Hook
// Uses revenueStreamService for data operations
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  revenueStreamService, 
  type BPRevenueStream, 
  type BPRevenueStreamInsert 
} from '@/services';

// Re-export types for backward compatibility
export type { BPRevenueStream };

export function useBPRevenueStreams(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['bp_revenue_streams', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      return revenueStreamService.getByBusinessPlanId(businessPlanId);
    },
    enabled: !!user && !!businessPlanId,
  });

  const createStream = useMutation({
    mutationFn: async (data: BPRevenueStreamInsert) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');
      return revenueStreamService.create(user.id, businessPlanId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', businessPlanId] });
      toast.success('Flux de revenus créé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateStream = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPRevenueStream> & { id: string }) => {
      await revenueStreamService.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', businessPlanId] });
      toast.success('Flux mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteStream = useMutation({
    mutationFn: async (id: string) => {
      await revenueStreamService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', businessPlanId] });
      toast.success('Flux supprimé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Use service utility method
  const totalMonthlyRevenue = revenueStreamService.calculateTotalMonthlyRevenue(streams);

  return {
    streams,
    isLoading,
    createStream,
    updateStream,
    deleteStream,
    totalMonthlyRevenue,
  };
}
