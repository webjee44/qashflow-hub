// ============================================
// useBPInvestments Hook
// Uses investmentService for data operations
// Now uses company_id instead of business_plan_id
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';
import { 
  investmentService, 
  type BPInvestment, 
  type BPInvestmentInsert,
  INVESTMENT_CATEGORIES,
} from '../api';

// Re-export types and constants for backward compatibility
export type { BPInvestment };
export { INVESTMENT_CATEGORIES };

export function useBPInvestments() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = currentCompany?.id;

  const { data: investments = [], isLoading } = useQuery({
    queryKey: ['bp_investments', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return investmentService.getByCompanyId(companyId);
    },
    enabled: !!user && !!companyId,
  });

  const createInvestment = useMutation({
    mutationFn: async (data: BPInvestmentInsert) => {
      if (!user || !companyId) throw new Error('Not authenticated or no company');
      return investmentService.create(user.id, companyId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_investments', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['bp_investments', companyId] });
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
      queryClient.invalidateQueries({ queryKey: ['bp_investments', companyId] });
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
