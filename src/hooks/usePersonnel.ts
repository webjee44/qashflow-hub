import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, format, parseISO } from 'date-fns';

export interface Personnel {
  id: string;
  user_id: string;
  company_id: string | null;
  position: string;
  gross_salary: number;
  employer_charges_rate: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function usePersonnel() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch personnel
  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ['bp_personnel', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('bp_personnel')
        .select('*')
        .order('created_at', { ascending: true });

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Personnel[];
    },
    enabled: !!user,
  });

  // Create personnel mutation
  const createPersonnel = useMutation({
    mutationFn: async (data: Partial<Personnel>) => {
      if (!user) throw new Error('Not authenticated');

      const { data: newPersonnel, error } = await supabase
        .from('bp_personnel')
        .insert({
          user_id: user.id,
          company_id: currentCompany?.id || null,
          position: data.position || 'Nouveau poste',
          gross_salary: data.gross_salary || 0,
          employer_charges_rate: data.employer_charges_rate ?? 0.45,
          start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
          end_date: data.end_date || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newPersonnel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel'] });
      toast({ title: 'Poste créé', description: 'Le poste a été ajouté' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Update personnel mutation
  const updatePersonnel = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Personnel> & { id: string }) => {
      const { error } = await supabase
        .from('bp_personnel')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel'] });
      toast({ title: 'Poste mis à jour' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Delete personnel mutation
  const deletePersonnel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_personnel')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_personnel'] });
      toast({ title: 'Poste supprimé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Helper: check if personnel is active for a given month
  const isPersonnelActiveForMonth = (person: Personnel, month: Date): boolean => {
    const monthStart = startOfMonth(month);
    const startDate = parseISO(person.start_date);
    const endDate = person.end_date ? parseISO(person.end_date) : null;

    if (monthStart < startOfMonth(startDate)) return false;
    if (endDate && monthStart > startOfMonth(endDate)) return false;
    return true;
  };

  // Helper: get total cost for one personnel (salary + employer charges)
  const getTotalCost = (person: Personnel): number => {
    const salary = Number(person.gross_salary);
    const charges = salary * Number(person.employer_charges_rate);
    return salary + charges;
  };

  // Helper: get total personnel cost for a month
  const getTotalForMonth = (month: Date): number => {
    return personnel
      .filter(p => isPersonnelActiveForMonth(p, month))
      .reduce((sum, p) => sum + getTotalCost(p), 0);
  };

  // Helper: get salary breakdown for a month
  const getBreakdownForMonth = (month: Date): { grossSalaries: number; employerCharges: number; total: number } => {
    const activePersonnel = personnel.filter(p => isPersonnelActiveForMonth(p, month));
    const grossSalaries = activePersonnel.reduce((sum, p) => sum + Number(p.gross_salary), 0);
    const employerCharges = activePersonnel.reduce((sum, p) => sum + (Number(p.gross_salary) * Number(p.employer_charges_rate)), 0);
    return {
      grossSalaries,
      employerCharges,
      total: grossSalaries + employerCharges,
    };
  };

  return {
    personnel,
    isLoading,
    createPersonnel,
    updatePersonnel,
    deletePersonnel,
    isPersonnelActiveForMonth,
    getTotalCost,
    getTotalForMonth,
    getBreakdownForMonth,
  };
}
