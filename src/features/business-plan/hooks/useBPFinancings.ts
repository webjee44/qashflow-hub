// ============================================
// useBPFinancings Hook
// Uses financingService for data operations
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  financingService, 
  type BPFinancing, 
  type BPFinancingInsert,
} from '@/services';

// Re-export types for backward compatibility
export type { BPFinancing };

export function useBPFinancings(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: financings = [], isLoading } = useQuery({
    queryKey: ['bp_financings', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      return financingService.getByBusinessPlanId(businessPlanId);
    },
    enabled: !!user && !!businessPlanId,
  });

  const createFinancing = useMutation({
    mutationFn: async (data: BPFinancingInsert) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');
      return financingService.create(user.id, businessPlanId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings', businessPlanId] });
      toast.success('Financement créé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateFinancing = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPFinancing> & { id: string }) => {
      await financingService.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings', businessPlanId] });
      toast.success('Financement mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteFinancing = useMutation({
    mutationFn: async (id: string) => {
      await financingService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings', businessPlanId] });
      toast.success('Financement supprimé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Use service utility method
  const { totalCapital, totalLoans, totalGrants, totalFunding } = 
    financingService.calculateTotals(financings);

  return {
    financings,
    isLoading,
    createFinancing,
    updateFinancing,
    deleteFinancing,
    totalCapital,
    totalLoans,
    totalGrants,
    totalFunding,
  };
}
