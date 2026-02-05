import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { toast } from 'sonner';
import { calculateLoanPayment, getLoanScheduleEntry } from '@/lib/french-rates';
import { parseISO, differenceInMonths, isBefore, isAfter, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { useCallback, useMemo } from 'react';

export interface Financing {
  id: string;
  user_id: string;
  company_id: string | null;
  investment_id: string | null;
  financing_type: 'loan' | 'lease' | 'current_account' | 'capital' | 'grant';
  name: string;
  amount: number;
  interest_rate: number;
  duration_months: number;
  monthly_payment: number;
  start_date: string;
  end_date: string | null;
  is_blocked: boolean;
  is_operating_grant: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useFinancings() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: financings = [], isLoading } = useQuery({
    queryKey: ['bp_financings', currentCompany?.id],
    queryFn: async () => {
      const query = supabase
        .from('bp_financings')
        .select('*')
        .order('start_date', { ascending: false });

      if (currentCompany) {
        query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Financing[];
    },
    enabled: !!user,
  });

  const createFinancing = useMutation({
    mutationFn: async (financing: Partial<Financing>) => {
      const insertData = {
        name: financing.name!,
        financing_type: financing.financing_type || 'loan',
        amount: financing.amount || 0,
        interest_rate: financing.interest_rate || 0,
        duration_months: financing.duration_months || 60,
        monthly_payment: financing.monthly_payment || 0,
        start_date: financing.start_date || new Date().toISOString().split('T')[0],
        end_date: financing.end_date || null,
        investment_id: financing.investment_id || null,
        is_blocked: financing.is_blocked ?? false,
        is_operating_grant: financing.is_operating_grant ?? true,
        notes: financing.notes || null,
        user_id: user!.id,
        company_id: currentCompany?.id || null,
      };
      
      const { data, error } = await supabase
        .from('bp_financings')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings'] });
      toast.success('Financement créé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la création');
      console.error(error);
    },
  });

  const updateFinancing = useMutation({
    mutationFn: async (financing: Financing) => {
      const { data, error } = await supabase
        .from('bp_financings')
        .update(financing)
        .eq('id', financing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings'] });
      toast.success('Financement mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    },
  });

  const deleteFinancing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bp_financings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_financings'] });
      toast.success('Financement supprimé');
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    },
  });

  // Helper: check if financing is active in a given month
  const isActiveInMonth = useCallback((financing: Financing, month: Date): boolean => {
    const startDate = parseISO(financing.start_date);
    const endDate = financing.end_date ? parseISO(financing.end_date) : addMonths(startDate, financing.duration_months);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    
    return !isAfter(startDate, monthEnd) && !isBefore(endDate, monthStart);
  }, []);

  // Helper: get month index for a financing (0-based)
  const getMonthIndex = useCallback((financing: Financing, month: Date): number => {
    const startDate = parseISO(financing.start_date);
    return differenceInMonths(startOfMonth(month), startOfMonth(startDate));
  }, []);

  // Get total monthly lease payments for a given month
  const getMonthlyLeasePayments = useCallback((month: Date): number => {
    return financings
      .filter(f => f.financing_type === 'lease' && isActiveInMonth(f, month))
      .reduce((sum, f) => sum + Number(f.monthly_payment), 0);
  }, [financings, isActiveInMonth]);

  // Get total monthly loan payments (capital + interest) for a given month
  const getMonthlyLoanPayments = useCallback((month: Date): number => {
    return financings
      .filter(f => f.financing_type === 'loan' && isActiveInMonth(f, month))
      .reduce((sum, f) => sum + Number(f.monthly_payment), 0);
  }, [financings, isActiveInMonth]);

  // Get monthly interest expense (for P&L) for a given month
  const getMonthlyInterestExpense = useCallback((month: Date): number => {
    return financings
      .filter(f => f.financing_type === 'loan' && isActiveInMonth(f, month))
      .reduce((sum, f) => {
        const monthIdx = getMonthIndex(f, month);
        if (monthIdx < 0 || monthIdx >= f.duration_months) return sum;
        
        const entry = getLoanScheduleEntry(
          Number(f.amount),
          Number(f.interest_rate),
          f.duration_months,
          monthIdx
        );
        return sum + entry.interest;
      }, 0);
  }, [financings, isActiveInMonth, getMonthIndex]);

  // Get loan disbursements (cash inflow when loan is granted) for a given month
  const getLoanDisbursements = useCallback((month: Date): number => {
    const monthStart = startOfMonth(month);
    
    return financings
      .filter(f => {
        if (f.financing_type !== 'loan') return false;
        const startDate = startOfMonth(parseISO(f.start_date));
        return startDate.getTime() === monthStart.getTime();
      })
      .reduce((sum, f) => sum + Number(f.amount), 0);
  }, [financings]);

  // Get capital repayments only (for cash flow detail) for a given month
  const getLoanCapitalRepayments = useCallback((month: Date): number => {
    return financings
      .filter(f => f.financing_type === 'loan' && isActiveInMonth(f, month))
      .reduce((sum, f) => {
        const monthIdx = getMonthIndex(f, month);
        if (monthIdx < 0 || monthIdx >= f.duration_months) return sum;
        
        const entry = getLoanScheduleEntry(
          Number(f.amount),
          Number(f.interest_rate),
          f.duration_months,
          monthIdx
        );
        return sum + entry.capital;
      }, 0);
  }, [financings, isActiveInMonth, getMonthIndex]);

  // Get total outstanding loan balance
  const getTotalOutstandingLoans = useCallback((atDate: Date = new Date()): number => {
    return financings
      .filter(f => f.financing_type === 'loan')
      .reduce((sum, f) => {
        const startDate = parseISO(f.start_date);
        if (isAfter(startDate, atDate)) {
          // Loan not yet started
          return sum + Number(f.amount);
        }
        
        const monthIdx = differenceInMonths(startOfMonth(atDate), startOfMonth(startDate));
        if (monthIdx >= f.duration_months) {
          // Loan fully repaid
          return sum;
        }
        
        const entry = getLoanScheduleEntry(
          Number(f.amount),
          Number(f.interest_rate),
          f.duration_months,
          monthIdx
        );
        return sum + entry.remaining;
      }, 0);
  }, [financings]);

  // Get total monthly payments (all financings)
  const getTotalMonthlyPayments = useCallback((): number => {
    return financings.reduce((sum, f) => sum + Number(f.monthly_payment), 0);
  }, [financings]);

  return {
    financings,
    isLoading,
    createFinancing,
    updateFinancing,
    deleteFinancing,
    getMonthlyLeasePayments,
    getMonthlyLoanPayments,
    getMonthlyInterestExpense,
    getLoanDisbursements,
    getLoanCapitalRepayments,
    getTotalOutstandingLoans,
    getTotalMonthlyPayments,
  };
}
