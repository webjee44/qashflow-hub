import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { calculateLoanPayment } from '@/lib/french-rates';

export interface BPFinancing {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
  investment_id: string | null;
  financing_type: 'capital' | 'loan' | 'grant' | 'current_account';
  name: string;
  amount: number;
  interest_rate: number;
  duration_months: number;
  monthly_payment: number;
  start_date: string;
  end_date: string | null;
  is_blocked: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useBPFinancings(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: financings = [], isLoading } = useQuery({
    queryKey: ['bp_financings', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      
      const { data, error } = await supabase
        .from('bp_financings')
        .select('*')
        .eq('business_plan_id', businessPlanId)
        .order('financing_type', { ascending: true });
      
      if (error) throw error;
      return (data || []) as BPFinancing[];
    },
    enabled: !!user && !!businessPlanId,
  });

  const createFinancing = useMutation({
    mutationFn: async (data: Partial<BPFinancing>) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');

      // Calculate monthly payment for loans
      let monthlyPayment = 0;
      if (data.financing_type === 'loan' && data.amount && data.interest_rate && data.duration_months) {
        const paymentInfo = calculateLoanPayment(data.amount, data.interest_rate, data.duration_months);
        monthlyPayment = paymentInfo.monthlyPayment;
      }

      const { data: newFinancing, error } = await supabase
        .from('bp_financings')
        .insert({
          user_id: user.id,
          business_plan_id: businessPlanId,
          name: data.name || 'Nouveau financement',
          financing_type: data.financing_type || 'loan',
          amount: data.amount || 0,
          interest_rate: data.interest_rate || 0,
          duration_months: data.duration_months || 60,
          monthly_payment: monthlyPayment,
          start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
          end_date: data.end_date || null,
          investment_id: data.investment_id || null,
          is_blocked: data.is_blocked ?? false,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return newFinancing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings', businessPlanId] });
      toast.success('Financement créé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateFinancing = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPFinancing> & { id: string }) => {
      const { error } = await supabase
        .from('bp_financings')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings', businessPlanId] });
      toast.success('Financement mis à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteFinancing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_financings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings', businessPlanId] });
      toast.success('Financement supprimé');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const totalCapital = financings
    .filter(f => f.financing_type === 'capital')
    .reduce((sum, f) => sum + Number(f.amount), 0);

  const totalLoans = financings
    .filter(f => f.financing_type === 'loan')
    .reduce((sum, f) => sum + Number(f.amount), 0);

  const totalGrants = financings
    .filter(f => f.financing_type === 'grant')
    .reduce((sum, f) => sum + Number(f.amount), 0);

  const totalFunding = totalCapital + totalLoans + totalGrants;

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
