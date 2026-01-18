import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, format, parseISO } from 'date-fns';
import { DIRECTOR_STATUSES } from '@/lib/french-rates';

export interface Director {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  status: string;
  monthly_remuneration: number;
  charges_rate: number;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useDirectors() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: directors = [], isLoading } = useQuery({
    queryKey: ['bp_directors', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('bp_directors')
        .select('*')
        .order('created_at', { ascending: true });

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Director[];
    },
    enabled: !!user,
  });

  const createDirector = useMutation({
    mutationFn: async (data: Partial<Director>) => {
      if (!user) throw new Error('Not authenticated');

      const statusInfo = DIRECTOR_STATUSES.find(s => s.value === data.status) || DIRECTOR_STATUSES[0];

      const { data: newDirector, error } = await supabase
        .from('bp_directors')
        .insert({
          user_id: user.id,
          company_id: currentCompany?.id || null,
          name: data.name || 'Dirigeant',
          status: data.status || 'assimile_salarie',
          monthly_remuneration: data.monthly_remuneration || 0,
          charges_rate: data.charges_rate ?? statusInfo.chargesRate,
          start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
          end_date: data.end_date || null,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newDirector;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_directors'] });
      toast({ title: 'Dirigeant ajouté' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateDirector = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Director> & { id: string }) => {
      const { error } = await supabase
        .from('bp_directors')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_directors'] });
      toast({ title: 'Dirigeant mis à jour' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const deleteDirector = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_directors')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_directors'] });
      toast({ title: 'Dirigeant supprimé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Vérifier si un dirigeant est actif pour un mois donné
  const isDirectorActiveForMonth = (director: Director, month: Date): boolean => {
    const monthStart = startOfMonth(month);
    const startDate = parseISO(director.start_date);
    const endDate = director.end_date ? parseISO(director.end_date) : null;

    if (monthStart < startOfMonth(startDate)) return false;
    if (endDate && monthStart > startOfMonth(endDate)) return false;
    return true;
  };

  // Coût total d'un dirigeant (rémunération + charges)
  const getTotalCost = (director: Director): number => {
    const remuneration = Number(director.monthly_remuneration);
    const charges = remuneration * Number(director.charges_rate);
    return remuneration + charges;
  };

  // Total des coûts dirigeants pour un mois
  const getTotalForMonth = (month: Date): number => {
    return directors
      .filter(d => isDirectorActiveForMonth(d, month))
      .reduce((sum, d) => sum + getTotalCost(d), 0);
  };

  // Breakdown pour un mois
  const getBreakdownForMonth = (month: Date): { remuneration: number; charges: number; total: number } => {
    const activeDirectors = directors.filter(d => isDirectorActiveForMonth(d, month));
    const remuneration = activeDirectors.reduce((sum, d) => sum + Number(d.monthly_remuneration), 0);
    const charges = activeDirectors.reduce((sum, d) => sum + (Number(d.monthly_remuneration) * Number(d.charges_rate)), 0);
    return {
      remuneration,
      charges,
      total: remuneration + charges,
    };
  };

  return {
    directors,
    isLoading,
    createDirector,
    updateDirector,
    deleteDirector,
    isDirectorActiveForMonth,
    getTotalCost,
    getTotalForMonth,
    getBreakdownForMonth,
  };
}
