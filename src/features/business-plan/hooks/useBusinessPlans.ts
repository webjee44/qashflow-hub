// ============================================
// useBusinessPlans Hook
// Uses businessPlanService for data operations
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  businessPlanService, 
  type BusinessPlan, 
  type BusinessPlanInsert, 
  type BusinessPlanUpdate 
} from '../api';

// Re-export types for backward compatibility
export type { BusinessPlan, BusinessPlanInsert, BusinessPlanUpdate };

export function useBusinessPlans() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: businessPlans = [], isLoading } = useQuery({
    queryKey: ['business_plans', currentCompany?.id],
    queryFn: async () => {
      if (currentCompany?.id) {
        return businessPlanService.getByCompanyId(currentCompany.id);
      }
      return businessPlanService.getAll();
    },
    enabled: !!user,
  });

  const createBusinessPlan = useMutation({
    mutationFn: async (data: Omit<BusinessPlanInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated');
      return businessPlanService.create({
        ...data,
        user_id: user.id,
        company_id: currentCompany?.id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_plans'] });
      toast({ title: 'Business Plan créé' });
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        queryClient.invalidateQueries({ queryKey: ['business_plans'] });
        return;
      }
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateBusinessPlan = useMutation({
    mutationFn: async ({ id, ...data }: BusinessPlanUpdate & { id: string }) => {
      await businessPlanService.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_plans'] });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const finalizeBusinessPlan = useMutation({
    mutationFn: async (id: string) => {
      await businessPlanService.finalize(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_plans'] });
      toast({ title: 'Business Plan finalisé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  return {
    businessPlans,
    isLoading,
    createBusinessPlan,
    updateBusinessPlan,
    finalizeBusinessPlan,
  };
}
