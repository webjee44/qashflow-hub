import { useMemo } from 'react';
import { TrendingUp, Euro, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useRevenueStreams } from '@/hooks/useRevenueStreams';
import { useBPSettings } from '@/hooks/useBPSettings';
import { parseISO, addMonths, startOfMonth, setMonth, setDate, setYear, getYear } from 'date-fns';

export function RevenueSummaryCard() {
  const { streams, getForecast, getTotalYearlyRevenue } = useRevenueStreams();
  const { settings } = useBPSettings();

  // Calculate fiscal years (same logic as RevenueTable)
  const fiscalYears = useMemo(() => {
    const bpStartDate = settings?.bp_start_date ? parseISO(settings.bp_start_date) : new Date();
    const bpYears = settings?.bp_years || 3;
    const fiscalStartMonth = (settings?.fiscal_year_start_month || 1) - 1;
    const fiscalStartDay = settings?.fiscal_year_start_day || 1;

    const years: { label: string; startDate: Date; endDate: Date; months: Date[] }[] = [];
    
    let currentStart = setDate(setMonth(bpStartDate, fiscalStartMonth), fiscalStartDay);
    if (currentStart > bpStartDate) {
      currentStart = setYear(currentStart, getYear(currentStart) - 1);
    }

    for (let i = 0; i < bpYears; i++) {
      const yearStart = i === 0 ? bpStartDate : addMonths(currentStart, 12 * i);
      const yearEnd = addMonths(setDate(setMonth(yearStart, fiscalStartMonth), fiscalStartDay), 12);
      
      const months: Date[] = [];
      let monthCursor = startOfMonth(yearStart);
      while (monthCursor < yearEnd) {
        months.push(monthCursor);
        monthCursor = addMonths(monthCursor, 1);
      }
      
      const startYear = getYear(yearStart);
      const endYear = getYear(yearEnd);
      const label = startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`;
      
      years.push({
        label,
        startDate: yearStart,
        endDate: yearEnd,
        months: months.slice(0, 12),
      });
    }

    return years;
  }, [settings]);

  const year1Months = fiscalYears[0]?.months || [];

  // Calculate totals per year
  const yearlyTotals = useMemo(() => {
    return fiscalYears.map((_, yearIndex) => getTotalYearlyRevenue(yearIndex, year1Months));
  }, [fiscalYears, getTotalYearlyRevenue, year1Months]);

  const grandTotal = yearlyTotals.reduce((sum, val) => sum + val, 0);
  const year1Total = yearlyTotals[0] || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (streams.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Year 1 Total */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Euro className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">C.A. Année 1</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(year1Total)}</p>
            </div>
          </div>

          {/* Separator */}
          <div className="hidden md:block h-12 w-px bg-border" />

          {/* Per-year breakdown */}
          <div className="flex flex-wrap items-center gap-6">
            {fiscalYears.map((year, i) => (
              <div key={i} className="text-center">
                <p className="text-xs text-muted-foreground">Année {i + 1}</p>
                <p className={`text-lg font-semibold ${i === 0 ? 'text-success' : 'text-foreground'}`}>
                  {formatCurrency(yearlyTotals[i])}
                </p>
              </div>
            ))}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
