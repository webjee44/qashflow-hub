import { useBalanceSheet } from '@/hooks/useBalanceSheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export function BFRChart() {
  const { data, isLoading } = useBalanceSheet();

  if (isLoading) {
    return <div className="h-[350px] animate-pulse bg-muted rounded-lg" />;
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const chartData = data.years.map((year, i) => ({
    year: year.label,
    bfr: data.bfr[i],
    workingCapital: data.workingCapital[i],
    netCash: data.workingCapital[i] - data.bfr[i],
  }));

  // Check if any year has negative net cash (BFR > Working Capital)
  const hasIssues = chartData.some(d => d.netCash < 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Évolution BFR vs Fonds de Roulement</CardTitle>
        {hasIssues ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Besoin de financement
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle className="h-4 w-4" />
            Équilibre financier
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="year" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
            />
            <YAxis 
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }} 
            />
            <Legend />
            <Bar 
              dataKey="bfr" 
              name="BFR" 
              fill="hsl(45, 93%, 47%)"
              radius={[4, 4, 0, 0]} 
            />
            <Bar 
              dataKey="workingCapital" 
              name="Fonds de Roulement" 
              fill="hsl(142, 76%, 36%)"
              radius={[4, 4, 0, 0]} 
            />
            <Line 
              type="monotone" 
              dataKey="netCash" 
              name="Trésorerie nette"
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={3}
              dot={{ fill: 'hsl(221, 83%, 53%)', strokeWidth: 2, r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          {chartData.map((d, i) => (
            <div key={i} className="text-center">
              <p className="text-xs text-muted-foreground">{d.year}</p>
              <p className={`text-lg font-bold ${d.netCash >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(d.netCash)}
              </p>
              <p className="text-xs text-muted-foreground">
                {d.netCash >= 0 ? 'Excédent' : 'Déficit'}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
