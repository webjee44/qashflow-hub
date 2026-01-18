import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';

export type PaymentFrequency = 'monthly' | 'quarterly' | 'biannual' | 'annual';

export interface BPFixedExpense {
  id: string;
  user_id: string;
  company_id: string | null;
  business_plan_id: string | null;
  name: string;
  category: string;
  monthly_amount: number;
  vat_rate: number;
  is_vat_deductible: boolean;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  payment_frequency: PaymentFrequency;
  payment_months: number[] | null;
  created_at: string;
  updated_at: string;
}

export const FIXED_EXPENSE_CATEGORIES = {
  rent: { label: 'Loyer', icon: 'Building2' },
  insurance: { label: 'Assurances', icon: 'Shield' },
  software: { label: 'Logiciels & Abonnements', icon: 'Laptop' },
  marketing: { label: 'Marketing', icon: 'Megaphone' },
  utilities: { label: 'Charges & Fluides', icon: 'Zap' },
  professional_fees: { label: 'Honoraires', icon: 'Briefcase' },
  other: { label: 'Autres', icon: 'MoreHorizontal' },
};

export const PAYMENT_FREQUENCIES = {
  monthly: { label: 'Mensuel', multiplier: 1 },
  quarterly: { label: 'Trimestriel', multiplier: 3 },
  biannual: { label: 'Semestriel', multiplier: 6 },
  annual: { label: 'Annuel', multiplier: 12 },
};

export const DEFAULT_PAYMENT_MONTHS: Record<PaymentFrequency, number[]> = {
  monthly: [],
  quarterly: [1, 4, 7, 10], // Jan, Avr, Juil, Oct
  biannual: [1, 7], // Jan, Juil
  annual: [1], // Janvier
};

export function useBPFixedExpenses(businessPlanId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['bp_fixed_expenses', businessPlanId],
    queryFn: async () => {
      if (!businessPlanId) return [];
      
      const { data, error } = await supabase
        .from('bp_fixed_expenses')
        .select('*')
        .eq('business_plan_id', businessPlanId)
        .order('category', { ascending: true });
      
      if (error) throw error;
      return (data || []) as BPFixedExpense[];
    },
    enabled: !!user && !!businessPlanId,
  });

  const createExpense = useMutation({
    mutationFn: async (data: Partial<BPFixedExpense>) => {
      if (!user || !businessPlanId) throw new Error('Not authenticated or no BP');

      const frequency = data.payment_frequency || 'monthly';
      const paymentMonths = data.payment_months || DEFAULT_PAYMENT_MONTHS[frequency];

      const { data: newExpense, error } = await supabase
        .from('bp_fixed_expenses')
        .insert({
          user_id: user.id,
          business_plan_id: businessPlanId,
          name: data.name || 'Nouvelle charge',
          category: data.category || 'other',
          monthly_amount: data.monthly_amount || 0,
          vat_rate: data.vat_rate ?? 0.20,
          is_vat_deductible: data.is_vat_deductible ?? true,
          start_date: data.start_date || format(new Date(), 'yyyy-MM-dd'),
          end_date: data.end_date || null,
          notes: data.notes || null,
          payment_frequency: frequency,
          payment_months: paymentMonths.length > 0 ? paymentMonths : null,
        })
        .select()
        .single();

      if (error) throw error;
      return newExpense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses', businessPlanId] });
      toast.success('Charge fixe créée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BPFixedExpense> & { id: string }) => {
      const { error } = await supabase
        .from('bp_fixed_expenses')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses', businessPlanId] });
      toast.success('Charge fixe mise à jour');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_fixed_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses', businessPlanId] });
      toast.success('Charge fixe supprimée');
    },
    onError: (error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Calcul du montant mensualisé (pour affichage P&L)
  const getMonthlyAmount = (expense: BPFixedExpense): number => {
    const multiplier = PAYMENT_FREQUENCIES[expense.payment_frequency]?.multiplier || 1;
    return expense.monthly_amount / multiplier;
  };

  // Calcul du décaissement réel pour un mois donné (pour trésorerie)
  const getCashOutflowForMonth = (expense: BPFixedExpense, month: Date): number => {
    const monthNum = month.getMonth() + 1; // 1-12
    
    if (expense.payment_frequency === 'monthly') {
      return expense.monthly_amount;
    }
    
    const paymentMonths = expense.payment_months || DEFAULT_PAYMENT_MONTHS[expense.payment_frequency];
    if (paymentMonths.includes(monthNum)) {
      return expense.monthly_amount;
    }
    
    return 0;
  };

  const totalMonthlyExpenses = expenses.reduce((sum, e) => sum + getMonthlyAmount(e), 0);

  return {
    expenses,
    isLoading,
    createExpense,
    updateExpense,
    deleteExpense,
    totalMonthlyExpenses,
    categories: FIXED_EXPENSE_CATEGORIES,
    getMonthlyAmount,
    getCashOutflowForMonth,
  };
}
