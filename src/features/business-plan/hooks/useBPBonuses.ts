// ============================================
// Hook: useBPBonuses
// Gestion des primes de partage de la valeur
// Now uses company_id via personnel relationship
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bonusService, type BPBonus, type BPBonusInsert, type BPBonusUpdate, type BonusType } from '../api';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useBPPersonnel } from './useBPPersonnel';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';

export function useBPBonuses() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  
  // Get personnel to derive their IDs for querying bonuses
  const { personnel } = useBPPersonnel();
  const personnelIds = personnel.map(p => p.id);

  const queryKey = ['bp-bonuses', companyId, personnelIds.join(',')];

  const { data: bonuses = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => bonusService.getByPersonnelIds(personnelIds),
    enabled: !!companyId && personnelIds.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<BPBonusInsert, 'user_id'>) => {
      if (!user?.id) throw new Error('User not found');
      return bonusService.create(user.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp-bonuses'] });
      toast.success('Prime ajoutée');
    },
    onError: (error) => {
      logError('Error creating bonus:', error);
      toast.error('Erreur lors de l\'ajout de la prime');
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (bonuses: Omit<BPBonusInsert, 'user_id'>[]) => {
      if (!user?.id) throw new Error('User not found');
      return bonusService.bulkCreate(user.id, bonuses);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bp-bonuses'] });
      toast.success(`${data.length} prime(s) ajoutée(s)`);
    },
    onError: (error) => {
      logError('Error creating bonuses:', error);
      toast.error('Erreur lors de l\'ajout des primes');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BPBonusUpdate }) => 
      bonusService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp-bonuses'] });
      toast.success('Prime modifiée');
    },
    onError: (error) => {
      logError('Error updating bonus:', error);
      toast.error('Erreur lors de la modification');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bonusService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp-bonuses'] });
      toast.success('Prime supprimée');
    },
    onError: (error) => {
      logError('Error deleting bonus:', error);
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
