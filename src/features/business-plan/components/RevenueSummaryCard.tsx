import { useMemo } from 'react';
import { Euro } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useRevenueStreams } from '@/hooks/useRevenueStreams';
import { useRevenue } from '../hooks/useRevenue';

export function RevenueSummaryCard() {
  const { streams } = useRevenueStreams();
  const { revenue } = useRevenue();

  // Lot 4.1 — totals come from the financial model, NOT from a parallel
  // aggregation. This guarantees Revenue page = P&L = exports.
  const yearlyTotals = useMemo(() => revenue.totals.yearly, [revenue]);
  const fiscalYears = revenue.fiscalYears;
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
                <p className="text-xs text-muted-foreground">{year.label}</p>
                <p className={`text-lg font-semibold ${i === 0 ? 'text-success' : 'text-foreground'}`}>
                  {formatCurrency(yearlyTotals[i] || 0)}
                </p>
              </div>
            ))}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
