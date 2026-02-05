// ============================================
// ExternalServicesSummary - Synthèse poste 61/62
// Affiche la ventilation complète des charges externes
// pour correspondre au calcul du P&L
// ============================================

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Building2, Users, Car, Percent, HelpCircle, FileText, TrendingDown, AlertCircle } from 'lucide-react';
import { useBPFixedExpenses } from '@/hooks/useBPFixedExpenses';
import { useVariableExpenses } from '@/hooks/useVariableExpenses';
import { useBPSettings } from '../hooks/useBPSettings';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { startOfMonth, addMonths, parseISO } from 'date-fns';
import { PAYMENT_FREQUENCIES } from '@/constants/bpConstants';

interface SummaryLine {
  label: string;
  icon: React.ReactNode;
  yearlyAmounts: number[];
  tooltip: string;
  count?: number;
}

export function ExternalServicesSummary() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { expenses: fixedExpenses } = useBPFixedExpenses();
  const { expenses: variableExpenses } = useVariableExpenses();
  const { settings } = useBPSettings();
  const companyId = currentCompany?.id;

  // Fetch personnel (freelances)
  const { data: personnel = [] } = useQuery({
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

  // Fetch financings (leasing)
  const { data: financings = [] } = useQuery({
    queryKey: ['bp_financings', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('bp_financings')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!companyId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const summaryData = useMemo(() => {
    const numYears = settings.bp_years || 3;
    const startDate = settings.bp_start_date ? new Date(settings.bp_start_date) : new Date();
    const fiscalStartMonth = settings.fiscal_year_start_month || 1;
    const fiscalStartDay = settings.fiscal_year_start_day || 1;

    // Build fiscal years
    const years: { start: Date; end: Date; months: Date[] }[] = [];
    let fiscalYearStart = new Date(startDate.getFullYear(), fiscalStartMonth - 1, fiscalStartDay);
    if (fiscalYearStart > startDate) {
      fiscalYearStart = new Date(startDate.getFullYear() - 1, fiscalStartMonth - 1, fiscalStartDay);
    }

    for (let i = 0; i < numYears; i++) {
      const yearStart = new Date(fiscalYearStart);
      yearStart.setFullYear(yearStart.getFullYear() + i);
      const yearEnd = new Date(yearStart);
      yearEnd.setFullYear(yearEnd.getFullYear() + 1);
      yearEnd.setDate(yearEnd.getDate() - 1);

      const months: Date[] = [];
      let currentMonth = startOfMonth(yearStart);
      while (currentMonth < yearEnd) {
        months.push(new Date(currentMonth));
        currentMonth = addMonths(currentMonth, 1);
      }
      years.push({ start: yearStart, end: yearEnd, months });
    }

    // Helper: check if expense is active for a month
    const isActiveForMonth = (startDateStr: string, endDateStr: string | null, month: Date): boolean => {
      const monthStart = startOfMonth(month);
      const sDate = parseISO(startDateStr);
      const eDate = endDateStr ? parseISO(endDateStr) : null;
      if (monthStart < startOfMonth(sDate)) return false;
      if (eDate && monthStart > startOfMonth(eDate)) return false;
      return true;
    };

    // Helper: get fixed expense for month (normalized to monthly)
    const getFixedExpenseForMonth = (expense: any, month: Date): number => {
      if (!isActiveForMonth(expense.start_date, expense.end_date, month)) return 0;
      const freq = expense.payment_frequency || 'monthly';
      const multiplier = PAYMENT_FREQUENCIES[freq as keyof typeof PAYMENT_FREQUENCIES]?.multiplier || 1;
      return (Number(expense.monthly_amount) || 0) / multiplier;
    };

    // Categories that go into 61/62
    const serviceCategories = ['rent', 'insurance', 'software', 'telecom', 'marketing', 'professional_fees', 'banking', 'travel'];
    const serviceExpenses = fixedExpenses.filter(e => serviceCategories.includes(e.category || ''));
    
    // Freelances
    const freelancers = personnel.filter(p => p.worker_type === 'freelance');
    
    // Leasing (crédit-bail)
    const leasings = financings.filter(f => f.financing_type === 'lease');
    
    // Variable expenses that go into services (commission, payment_fees)
    const variableServices = variableExpenses.filter(e => 
      ['commission', 'payment_fees', 'transaction_fees'].includes(e.category || '')
    );

    // Calculate yearly totals for each line
    const calculateYearly = (calcFn: (month: Date) => number): number[] => {
      return years.map(year => 
        year.months.reduce((sum, month) => sum + calcFn(month), 0)
      );
    };

    // 1. Fixed services
    const fixedServicesYearly = calculateYearly(month =>
      serviceExpenses.reduce((sum, e) => sum + getFixedExpenseForMonth(e, month), 0)
    );

    // 2. Freelances
    const freelanceYearly = calculateYearly(month =>
      freelancers.reduce((sum, p) => {
        if (!isActiveForMonth(p.start_date, p.end_date, month)) return sum;
        const dailyRate = Number(p.daily_rate) || 0;
        const daysPerMonth = Number(p.estimated_days_per_month) || 0;
        return sum + (dailyRate * daysPerMonth);
      }, 0)
    );

    // 3. Leasing
    const leasingYearly = calculateYearly(month =>
      leasings.reduce((sum, fin) => {
        if (!isActiveForMonth(fin.start_date, fin.end_date, month)) return sum;
        return sum + (Number(fin.monthly_payment) || 0);
      }, 0)
    );

    // 4. Variable services (simplified - % of total revenue is harder without streams)
    // We just show as "configured" since real calculation needs revenue data
    const variableServicesConfigured = variableServices.length;

    // Total
    const totalYearly = years.map((_, i) => 
      fixedServicesYearly[i] + freelanceYearly[i] + leasingYearly[i]
    );

    const lines: SummaryLine[] = [
      {
        label: 'Charges fixes services',
        icon: <Building2 className="h-4 w-4" />,
        yearlyAmounts: fixedServicesYearly,
        tooltip: `Loyer, assurances, logiciels, télécom, marketing, honoraires, banque, déplacements`,
        count: serviceExpenses.length,
      },
      {
        label: 'Freelances / Prestataires',
        icon: <Users className="h-4 w-4" />,
        yearlyAmounts: freelanceYearly,
        tooltip: 'Personnel extérieur (compte 621)',
        count: freelancers.length,
      },
      {
        label: 'Crédit-bail (leasing)',
        icon: <Car className="h-4 w-4" />,
        yearlyAmounts: leasingYearly,
        tooltip: 'Redevances de crédit-bail (compte 612)',
        count: leasings.length,
      },
    ];

    // Only add variable line if there are some configured
    if (variableServicesConfigured > 0) {
      lines.push({
        label: 'Charges variables services',
        icon: <Percent className="h-4 w-4" />,
        yearlyAmounts: years.map(() => 0), // Will be calculated based on actual revenue
        tooltip: 'Commissions et frais de paiement (calculés sur le CA réel)',
        count: variableServicesConfigured,
      });
    }

    return { lines, totalYearly, years, hasVariableServices: variableServicesConfigured > 0 };
  }, [fixedExpenses, variableExpenses, personnel, financings, settings]);

  if (summaryData.totalYearly.every(v => v === 0) && !summaryData.hasVariableServices) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Synthèse 61/62 - Services extérieurs</CardTitle>
          </div>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Ce total correspond au poste "Autres achats et charges externes (61/62)" du compte de résultat. Il agrège vos charges fixes de services + freelances + crédit-bail + charges variables de services.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>
          Ventilation du poste affiché dans le Compte de Résultat
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Header with years */}
          <div className="grid grid-cols-[1fr,repeat(3,100px)] gap-2 text-xs text-muted-foreground font-medium pb-1 border-b">
            <div>Composant</div>
            {summaryData.years.map((_, i) => (
              <div key={i} className="text-right">Année {i + 1}</div>
            ))}
          </div>

          {/* Lines */}
          {summaryData.lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[1fr,repeat(3,100px)] gap-2 items-center py-1">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-2 text-sm">
                    {line.icon}
                    <span>{line.label}</span>
                    {line.count !== undefined && line.count > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 h-4">
                        {line.count}
                      </Badge>
                    )}
                  </TooltipTrigger>
                  <TooltipContent>{line.tooltip}</TooltipContent>
                </Tooltip>
              </div>
              {line.yearlyAmounts.map((amount, i) => (
                <div key={i} className="text-right text-sm font-mono">
                  {amount > 0 ? (
                    <span className="text-destructive">{formatCurrency(amount)}</span>
                  ) : line.label.includes('variable') ? (
                    <span className="text-xs text-muted-foreground italic">% CA</span>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Total */}
          <div className="grid grid-cols-[1fr,repeat(3,100px)] gap-2 items-center pt-2 border-t border-primary/20">
            <div className="flex items-center gap-2 font-semibold">
              <TrendingDown className="h-4 w-4 text-primary" />
              <span>Total 61/62</span>
              {summaryData.hasVariableServices && (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    + charges variables calculées sur le CA (visibles dans le P&L)
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {summaryData.totalYearly.map((amount, i) => (
              <div key={i} className="text-right font-bold text-destructive">
                {formatCurrency(amount)}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
