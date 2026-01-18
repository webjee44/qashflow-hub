import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getGlobalChargesRate } from '@/lib/french-rates';

export type WorkerType = 'employee' | 'freelance' | 'intern';

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
  worker_type: WorkerType;
  daily_rate: number | null;
  estimated_days_per_month: number | null;
  // Payslip import fields
  mutuelle_employer_amount: number | null;
  at_mp_rate: number | null;
  payslip_imported: boolean;
  created_at: string;
  updated_at: string;
}

export const WORKER_TYPES = {
  employee: { label: 'Salarié', icon: 'User' },
  freelance: { label: 'Freelance / Prestataire', icon: 'Briefcase' },
  intern: { label: 'Stagiaire', icon: 'GraduationCap' },
};

export const CONTRACT_TYPES = {
  cdi: { label: 'CDI', workerType: 'employee' },
  cdd: { label: 'CDD', workerType: 'employee' },
  apprentissage: { label: 'Apprentissage', workerType: 'employee' },
  stage: { label: 'Stage', workerType: 'intern' },
  freelance: { label: 'Freelance / Prestation', workerType: 'freelance' },
};

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

  // Séparer salariés et freelances
  const employees = personnel.filter(p => p.worker_type === 'employee' || p.worker_type === 'intern');
  const freelancers = personnel.filter(p => p.worker_type === 'freelance');

  const createPersonnel = useMutation({
    mutationFn: async (data: Partial<BPPersonnel>) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');

      const workerType = data.worker_type || 'employee';
      const isFreelance = workerType === 'freelance';
      
      // Pour les freelances, pas de calcul de charges
      let chargesRate = 0;
      if (!isFreelance) {
        const grossSalary = data.gross_salary || 0;
        const isExecutive = data.is_executive ?? false;
        const companySize = (data.company_size || 'small') as 'small' | 'medium' | 'large';
        const contractType = data.contract_type || 'cdi';
        chargesRate = getGlobalChargesRate(grossSalary, isExecutive, companySize, contractType);
      }

      // Use provided charges rate if from payslip import
      const finalChargesRate = data.employer_charges_rate ?? chargesRate;

      const { data: newPerson, error } = await supabase
        .from('bp_personnel')
        .insert({
          user_id: user.id,
          business_plan_id: businessPlanId,
          position: data.position || 'Nouveau poste',
          gross_salary: isFreelance ? 0 : (data.gross_salary || 0),
          employer_charges_rate: finalChargesRate,
          start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
          end_date: data.end_date || null,
          notes: data.notes || null,
          contract_type: data.contract_type || (isFreelance ? 'freelance' : 'cdi'),
          is_executive: data.is_executive ?? false,
          company_size: data.company_size || 'small',
          worker_type: workerType,
          daily_rate: isFreelance ? (data.daily_rate || 0) : null,
          estimated_days_per_month: isFreelance ? (data.estimated_days_per_month || 0) : null,
          // Payslip import fields
          mutuelle_employer_amount: data.mutuelle_employer_amount ?? null,
          at_mp_rate: data.at_mp_rate ?? null,
          payslip_imported: data.payslip_imported ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return newPerson;
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
      // Recalculate charges if needed
      let updateData = { ...data };
      
      if (data.worker_type === 'freelance') {
        updateData.employer_charges_rate = 0;
        updateData.gross_salary = 0;
      } else if (data.gross_salary !== undefined || data.is_executive !== undefined || 
                 data.company_size !== undefined || data.contract_type !== undefined) {
        // Find existing person to merge with new data
        const existing = personnel.find(p => p.id === id);
        if (existing) {
          const grossSalary = data.gross_salary ?? existing.gross_salary;
          const isExecutive = data.is_executive ?? existing.is_executive;
          const companySize = (data.company_size || existing.company_size || 'small') as 'small' | 'medium' | 'large';
          const contractType = data.contract_type || existing.contract_type || 'cdi';
          updateData.employer_charges_rate = getGlobalChargesRate(grossSalary, isExecutive, companySize, contractType);
        }
      }

      const { error } = await supabase
        .from('bp_personnel')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
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
      const { error } = await supabase
        .from('bp_personnel')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel', businessPlanId] });
      toast.success('Membre supprimé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Calcul du coût mensuel (salariés)
  const getEmployeeMonthlyCost = (person: BPPersonnel): number => {
    const salary = Number(person.gross_salary);
    const charges = salary * Number(person.employer_charges_rate);
    return salary + charges;
  };

  // Calcul du coût mensuel (freelances)
  const getFreelanceMonthlyCost = (person: BPPersonnel): number => {
    const dailyRate = Number(person.daily_rate) || 0;
    const daysPerMonth = Number(person.estimated_days_per_month) || 0;
    return dailyRate * daysPerMonth;
  };

  // Coût mensuel total d'un membre
  const getMonthlyCost = (person: BPPersonnel): number => {
    if (person.worker_type === 'freelance') {
      return getFreelanceMonthlyCost(person);
    }
    return getEmployeeMonthlyCost(person);
  };

  const totalEmployeeCost = employees.reduce((sum, p) => sum + getEmployeeMonthlyCost(p), 0);
  const totalFreelanceCost = freelancers.reduce((sum, p) => sum + getFreelanceMonthlyCost(p), 0);
  const totalMonthlyCost = totalEmployeeCost + totalFreelanceCost;

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
