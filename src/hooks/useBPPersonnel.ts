import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getGlobalChargesRate } from '@/lib/french-rates';

export interface BPPersonnel {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
  position: string;
  gross_salary: number;
  employer_charges_rate: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  contract_type: string;
  is_executive: boolean;
  company_size: string;
  created_at: string;
  updated_at: string;
}

export function useBPPersonnel(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ['bp_personnel', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      
      const { data, error } = await supabase
        .from('bp_personnel')
        .select('*')
        .eq('business_plan_id', businessPlanId)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return (data || []) as BPPersonnel[];
    },
    enabled: !!user && !!businessPlanId,
  });

  const createPersonnel = useMutation({
    mutationFn: async (data: Partial<BPPersonnel>) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');

      const grossSalary = data.gross_salary || 0;
      const isExecutive = data.is_executive ?? false;
      const companySize = (data.company_size || 'small') as 'small' | 'medium' | 'large';
      const contractType = data.contract_type || 'cdi';
      const chargesRate = getGlobalChargesRate(grossSalary, isExecutive, companySize, contractType);

      const { data: newPerson, error } = await supabase
        .from('bp_personnel')
        .insert({
          user_id: user.id,
          business_plan_id: businessPlanId,
          position: data.position || 'Nouveau poste',
          gross_salary: grossSalary,
          employer_charges_rate: chargesRate,
          start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
          end_date: data.end_date || null,
          notes: data.notes || null,
          contract_type: contractType,
          is_executive: isExecutive,
          company_size: companySize,
        })
        .select()
        .single();

      if (error) throw error;
      return newPerson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel', businessPlanId] });
      toast.success('Poste créé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updatePersonnel = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPPersonnel> & { id: string }) => {
      const { error } = await supabase
        .from('bp_personnel')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel', businessPlanId] });
      toast.success('Poste mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deletePersonnel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_personnel')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel', businessPlanId] });
      toast.success('Poste supprimé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const totalMonthlyCost = personnel.reduce((sum, p) => {
    const salary = Number(p.gross_salary);
    const charges = salary * Number(p.employer_charges_rate);
    return sum + salary + charges;
  }, 0);

  return {
    personnel,
    isLoading,
    createPersonnel,
    updatePersonnel,
    deletePersonnel,
    totalMonthlyCost,
  };
}
