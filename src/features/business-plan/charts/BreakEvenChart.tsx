import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { useBPRatios } from '@/hooks/useBPRatios';
import { useProfitLoss } from '@/hooks/useProfitLoss';

interface BreakEvenChartProps {
  yearIndex?: number;
}

export function BreakEvenChart({ yearIndex = 0 }: BreakEvenChartProps) {
  const { getBreakEvenData, isLoading } = useBPRatios();
  const { data: plData } = useProfitLoss();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement...
        </CardContent>
      </Card>
    );
  }

  const beData = getBreakEvenData(yearIndex);
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  // Generate chart data points
  const maxRevenue = beData.revenue * 1.3;
  const steps = 20;
  const chartData = Array.from({ length: steps + 1 }, (_, i) => {
    const revenue = (maxRevenue / steps) * i;
    const variableRatio = beData.revenue > 0 ? beData.variableCosts / beData.revenue : 0;
    const totalCosts = beData.fixedCosts + (revenue * variableRatio);
    const profit = revenue - totalCosts;

    return {
      revenue,
      revenueLabel: `${Math.round(revenue / 1000)}k`,
      totalCosts,
      profit,
      fixedCosts: beData.fixedCosts,
    };
  });

  const isProfitable = beData.revenue >= beData.breakEvenPoint;
  const monthsToBreakEven = beData.breakEvenMonths;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Seuil de rentabilité - Année {yearIndex + 1}
          </CardTitle>
          <Badge variant={isProfitable ? 'default' : 'destructive'}>
            {isProfitable ? 'Rentable' : 'Déficitaire'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
            <Target className="h-5 w-5 text-primary mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-1">Point mort</p>
            <p className="text-lg font-bold">{formatCurrency(beData.breakEvenPoint)}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
            <Calendar className="h-5 w-5 text-amber-500 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-1">Atteint en</p>
            <p className="text-lg font-bold">
              {monthsToBreakEven > 12 ? '> 12' : monthsToBreakEven} mois
            </p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
            <TrendingUp className="h-5 w-5 text-success mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-1">Marge de sécurité</p>
            <p className={`text-lg font-bold ${beData.safetyMarginPercent >= 0 ? 'text-success' : 'text-destructive'}`}>
              {beData.safetyMarginPercent.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="revenue" 
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              label={{ value: 'Chiffre d\'affaires (€)', position: 'bottom', offset: -5 }}
            />
            <YAxis 
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'revenue' ? 'CA' : name === 'totalCosts' ? 'Coûts totaux' : name === 'profit' ? 'Résultat' : name
              ]}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            
            {/* Break-even reference line */}
            <ReferenceLine 
              x={beData.breakEvenPoint} 
              stroke="hsl(var(--primary))" 
              strokeDasharray="5 5"
              label={{ 
                value: 'Seuil', 
                position: 'top',
                fill: 'hsl(var(--primary))',
                fontSize: 11
              }}
            />

            {/* Current revenue marker */}
            <ReferenceLine 
              x={beData.revenue} 
              stroke="hsl(142, 70%, 45%)" 
              strokeWidth={2}
              label={{ 
                value: 'CA Actuel', 
                position: 'top',
                fill: 'hsl(142, 70%, 45%)',
                fontSize: 11
              }}
            />

            {/* Fixed costs line */}
            <Line 
              type="monotone" 
              dataKey="fixedCosts" 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="3 3"
              dot={false}
              name="Charges fixes"
            />

            {/* Total costs line */}
            <Line 
              type="monotone" 
              dataKey="totalCosts" 
              stroke="hsl(0, 70%, 50%)" 
              strokeWidth={2}
              dot={false}
              name="Coûts totaux"
            />

            {/* Revenue line (45° line since x = revenue) */}
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(142, 70%, 45%)" 
              strokeWidth={2}
              dot={false}
              name="Chiffre d'affaires"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend/Explanation */}
        <div className="flex flex-wrap gap-4 justify-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-success" />
            <span className="text-muted-foreground">CA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-destructive" />
            <span className="text-muted-foreground">Coûts totaux</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-primary border-dashed" style={{ borderTop: '2px dashed' }} />
            <span className="text-muted-foreground">Seuil de rentabilité</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
