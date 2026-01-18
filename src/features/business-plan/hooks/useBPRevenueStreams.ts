// ============================================
// useBPRevenueStreams Hook
// Uses revenueStreamService for data operations
// Now uses company_id instead of business_plan_id
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';
import { 
  revenueStreamService, 
  type BPRevenueStream, 
  type BPRevenueStreamInsert 
} from '@/services';

// Re-export types for backward compatibility
export type { BPRevenueStream };

export function useBPRevenueStreams() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['bp_revenue_streams', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return revenueStreamService.getByCompanyId(companyId);
    },
    enabled: !!user && !!companyId,
  });

  const createStream = useMutation({
    mutationFn: async (data: BPRevenueStreamInsert) => {
      if (!user || !companyId) throw new Error('Not authenticated or no company');
      return revenueStreamService.create(user.id, companyId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams', companyId] });
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
