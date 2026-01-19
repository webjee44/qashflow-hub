// ============================================
// usePayrollTaxes Hook - Calcul automatique des taxes sur salaires
// Taxe d'apprentissage (0.68%) + Formation continue (0.55% ou 1%)
// ============================================

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { startOfMonth, parseISO } from 'date-fns';
import { URSSAF_RATES_2026 } from '@/lib/french-rates';

export interface PayrollTaxes {
  apprentissage: number;    // Taxe d'apprentissage (0.68%)
  formation: number;        // Participation formation continue (0.55% ou 1%)
  total: number;
  grossSalaries: number;    // Pour référence
  headcount: number;        // Effectif actif
}

export function usePayrollTaxes() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  // Fetch personnel data
  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ['bp_personnel', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bp_personnel')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!companyId,
  });

  // Check if personnel is active for a given month
  const isPersonnelActiveForMonth = useCallback((person: any, month: Date): boolean => {
    const monthStart = startOfMonth(month);
    const startDate = parseISO(person.start_date);
    const endDate = person.end_date ? parseISO(person.end_date) : null;
    
    if (monthStart < startOfMonth(startDate)) return false;
    if (endDate && monthStart > startOfMonth(endDate)) return false;
    return true;
  }, []);

  // Calculate payroll taxes for a specific month
  const getPayrollTaxesForMonth = useCallback((month: Date): PayrollTaxes => {
    const rates = URSSAF_RATES_2026.employer;
    
    // Filter active employees (excluding freelancers and interns)
    const activeEmployees = personnel.filter(p => 
      isPersonnelActiveForMonth(p, month) && 
      p.worker_type === 'employee' &&
      p.contract_type !== 'internship' &&
      p.contract_type !== 'intern'
    );
    
    // Calculate total gross salaries
    const grossSalaries = activeEmployees.reduce((sum, p) => 
      sum + (Number(p.gross_salary) || 0), 0
    );
    
    // Headcount for formation rate determination
    const headcount = activeEmployees.length;
    const isSmallCompany = headcount < 11;
    
    // Taxe d'apprentissage: 0.68% of gross salaries
    const apprentissage = grossSalaries * rates.apprentissage;
    
    // Formation continue: 0.55% (<11 employees) or 1% (≥11 employees)
    const formationRate = isSmallCompany ? rates.formation.small : rates.formation.large;
    const formation = grossSalaries * formationRate;
    
    return {
      apprentissage,
      formation,
      total: apprentissage + formation,
      grossSalaries,
      headcount,
    };
  }, [personnel, isPersonnelActiveForMonth]);

  // Calculate annual payroll taxes (sum of 12 months)
  const getAnnualPayrollTaxes = useCallback((year: Date[]): PayrollTaxes => {
    const monthlyTaxes = year.map(month => getPayrollTaxesForMonth(month));
    
    return {
      apprentissage: monthlyTaxes.reduce((sum, t) => sum + t.apprentissage, 0),
      formation: monthlyTaxes.reduce((sum, t) => sum + t.formation, 0),
      total: monthlyTaxes.reduce((sum, t) => sum + t.total, 0),
      grossSalaries: monthlyTaxes.reduce((sum, t) => sum + t.grossSalaries, 0),
      headcount: Math.max(...monthlyTaxes.map(t => t.headcount), 0),
    };
  }, [getPayrollTaxesForMonth]);

  // Get rate information for display
  const rates = useMemo(() => ({
    apprentissage: URSSAF_RATES_2026.employer.apprentissage * 100, // 0.68%
    formationSmall: URSSAF_RATES_2026.employer.formation.small * 100, // 0.55%
    formationLarge: URSSAF_RATES_2026.employer.formation.large * 100, // 1%
    threshold: 11, // Seuil effectif pour taux formation
  }), []);

  return {
    personnel,
    isLoading,
    getPayrollTaxesForMonth,
    getAnnualPayrollTaxes,
    rates,
  };
}
