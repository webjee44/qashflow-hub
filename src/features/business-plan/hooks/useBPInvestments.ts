// ============================================
// useBPInvestments Hook
// Uses investmentService for data operations
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  investmentService, 
  type BPInvestment, 
  type BPInvestmentInsert,
  INVESTMENT_CATEGORIES,
} from '@/services';

// Re-export types and constants for backward compatibility
export type { BPInvestment };
export { INVESTMENT_CATEGORIES };

export function useBPInvestments(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ['bp_investments', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      return investmentService.getByBusinessPlanId(businessPlanId);
    },
    enabled: !!user && !!businessPlanId,
  });

  const createInvestment = useMutation({
    mutationFn: async (data: BPInvestmentInsert) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');
      return investmentService.create(user.id, businessPlanId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_investments', businessPlanId] });
      toast.success('Investissement créé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateInvestment = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPInvestment> & { id: string }) => {
      await investmentService.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_investments', businessPlanId] });
      toast.success('Investissement mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteInvestment = useMutation({
    mutationFn: async (id: string) => {
      await investmentService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_investments', businessPlanId] });
      toast.success('Investissement supprimé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Use service utility methods
  const totalInvestments = investmentService.calculateTotalInvestments(investments);
  const yearlyDepreciation = investmentService.calculateYearlyDepreciation(investments);

  return {
    investments,
    isLoading,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    totalInvestments,
    yearlyDepreciation,
    categories: INVESTMENT_CATEGORIES,
  };
}
