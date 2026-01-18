// ============================================
// Hook: useBPBonuses
// Gestion des primes de partage de la valeur
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bonusService, BPBonus, BPBonusInsert, BPBonusUpdate, BonusType } from '@/services/bonusService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function useBPBonuses(businessPlanId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const queryKey = ['bp-bonuses', businessPlanId];

  const { data: bonuses = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => bonusService.getByBusinessPlanId(businessPlanId!),
    enabled: !!businessPlanId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<BPBonusInsert, 'user_id' | 'business_plan_id'>) => {
      if (!user?.id || !businessPlanId) throw new Error('User or business plan not found');
      return bonusService.create({
        ...data,
        user_id: user.id,
        business_plan_id: businessPlanId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Prime ajoutée');
    },
    onError: (error) => {
      console.error('Error creating bonus:', error);
      toast.error('Erreur lors de l\'ajout de la prime');
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (bonuses: Omit<BPBonusInsert, 'user_id' | 'business_plan_id'>[]) => {
      if (!user?.id || !businessPlanId) throw new Error('User or business plan not found');
      const fullBonuses = bonuses.map(b => ({
        ...b,
        user_id: user.id,
        business_plan_id: businessPlanId,
      }));
      return bonusService.bulkCreate(fullBonuses);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(`${data.length} prime(s) ajoutée(s)`);
    },
    onError: (error) => {
      console.error('Error creating bonuses:', error);
      toast.error('Erreur lors de l\'ajout des primes');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BPBonusUpdate }) => 
      bonusService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Prime modifiée');
    },
    onError: (error) => {
      console.error('Error updating bonus:', error);
      toast.error('Erreur lors de la modification');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bonusService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Prime supprimée');
    },
    onError: (error) => {
      console.error('Error deleting bonus:', error);
      toast.error('Erreur lors de la suppression');
    },
  });

  // Calculs agrégés
  const totalBonuses = bonusService.calculateTotalByType(bonuses);
  const exemptAmount = bonusService.calculateExemptAmount(bonuses);
  const taxableAmount = bonusService.calculateTaxableAmount(bonuses);

  const getTotalByType = (type: BonusType) => 
    bonusService.calculateTotalByType(bonuses, type);

  const getTotalByPersonnel = (personnelId: string) => 
    bonusService.getTotalByPersonnel(bonuses, personnelId);

  const getBonusesByPersonnel = (personnelId: string) => 
    bonuses.filter(b => b.personnel_id === personnelId);

  return {
    bonuses,
    isLoading,
    error,
    
    // Mutations
    createBonus: createMutation.mutateAsync,
    bulkCreateBonuses: bulkCreateMutation.mutateAsync,
    updateBonus: updateMutation.mutate,
    deleteBonus: deleteMutation.mutate,
    
    // États mutations
    isCreating: createMutation.isPending || bulkCreateMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    
    // Calculs
    totalBonuses,
    exemptAmount,
    taxableAmount,
    getTotalByType,
    getTotalByPersonnel,
    getBonusesByPersonnel,
  };
}
