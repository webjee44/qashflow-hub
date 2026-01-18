// ============================================
// useBPFinancings Hook
// Uses financingService for data operations
// Now uses company_id instead of business_plan_id
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';
import { 
  financingService, 
  type BPFinancing, 
  type BPFinancingInsert,
} from '@/services';

// Re-export types for backward compatibility
export type { BPFinancing };

export function useBPFinancings() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  const { data: financings = [], isLoading } = useQuery({
    queryKey: ['bp_financings', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return financingService.getByCompanyId(companyId);
    },
    enabled: !!user && !!companyId,
  });

  const createFinancing = useMutation({
    mutationFn: async (data: BPFinancingInsert) => {
      if (!user || !companyId) throw new Error('Not authenticated or no company');
      return financingService.create(user.id, companyId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['bp_financings', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['bp_financings', companyId] });
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
