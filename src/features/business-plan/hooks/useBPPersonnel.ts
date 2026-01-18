// ============================================
// useBPPersonnel Hook
// Uses personnelService for data operations
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  personnelService, 
  type BPPersonnel, 
  type BPPersonnelInsert,
  WORKER_TYPES,
  CONTRACT_TYPES,
  type WorkerType,
} from '@/services';

// Re-export types and constants for backward compatibility
export type { BPPersonnel, WorkerType };
export { WORKER_TYPES, CONTRACT_TYPES };

export function useBPPersonnel(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ['bp_personnel', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      return personnelService.getByBusinessPlanId(businessPlanId);
    },
    enabled: !!user && !!businessPlanId,
  });

  // Use service utility for separation
  const { employees, freelancers } = personnelService.separateByType(personnel);

  const createPersonnel = useMutation({
    mutationFn: async (data: BPPersonnelInsert) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');
      return personnelService.create(user.id, businessPlanId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel', businessPlanId] });
      toast.success('Membre ajouté');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updatePersonnel = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPPersonnel> & { id: string }) => {
      await personnelService.update(id, data, personnel);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel', businessPlanId] });
      toast.success('Membre mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deletePersonnel = useMutation({
    mutationFn: async (id: string) => {
      await personnelService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel', businessPlanId] });
      toast.success('Membre supprimé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Use service utility methods
  const getMonthlyCost = (person: BPPersonnel) => personnelService.getMonthlyCost(person);
  const getEmployeeMonthlyCost = (person: BPPersonnel) => personnelService.getEmployeeMonthlyCost(person);
  const getFreelanceMonthlyCost = (person: BPPersonnel) => personnelService.getFreelanceMonthlyCost(person);

  // Use service for total calculations
  const { totalEmployeeCost, totalFreelanceCost, totalMonthlyCost } = 
    personnelService.calculateTotalCosts(personnel);

  return {
    personnel,
    employees,
    freelancers,
    isLoading,
    createPersonnel,
    updatePersonnel,
    deletePersonnel,
    getMonthlyCost,
    getEmployeeMonthlyCost,
    getFreelanceMonthlyCost,
    totalMonthlyCost,
    totalEmployeeCost,
    totalFreelanceCost,
  };
}
