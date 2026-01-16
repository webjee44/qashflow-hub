import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { useScenarios, Scenario } from '@/hooks/useScenarios';
import { useProfitLoss } from '@/hooks/useProfitLoss';
import { useState } from 'react';
import { GitBranch } from 'lucide-react';

type Metric = 'revenue' | 'netResult' | 'ebitda';

interface ScenarioComparisonChartProps {
  className?: string;
}

export function ScenarioComparisonChart({ className }: ScenarioComparisonChartProps) {
  const { scenarios, applyScenario, isLoading: scenariosLoading } = useScenarios();
  const { data: plData, isLoading: plLoading } = useProfitLoss();
  const [metric, setMetric] = useState<Metric>('revenue');

  if (scenariosLoading || plLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement...
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const getMetricLabel = (m: Metric) => {
    switch (m) {
      case 'revenue': return 'Chiffre d\'affaires';
      case 'netResult': return 'Résultat net';
      case 'ebitda': return 'EBE';
    }
  };

  // Calculate data for each scenario
  const chartData = plData.years.map((year, yearIndex) => {
    const baseRevenue = plData.totals.revenue[yearIndex] || 0;
    const baseExpenses = (plData.totals.fixedExpenses[yearIndex] || 0) +
                         (plData.totals.variableExpenses[yearIndex] || 0) +
                         (plData.totals.personnelCosts[yearIndex] || 0) +
                         (plData.totals.directorsCosts[yearIndex] || 0);
    const baseNetResult = plData.totals.netResult[yearIndex] || 0;
    const baseEbitda = plData.totals.ebitda[yearIndex] || 0;

    const dataPoint: Record<string, any> = {
      year: year.label,
    };

    scenarios.forEach(scenario => {
      const applied = applyScenario(scenario, baseRevenue, baseExpenses);
      
      switch (metric) {
        case 'revenue':
          dataPoint[scenario.name] = applied.revenue;
          break;
        case 'netResult':
          // Approximate: scale net result proportionally
          const revenueRatio = baseRevenue > 0 ? applied.revenue / baseRevenue : 1;
          const expenseRatio = baseExpenses > 0 ? applied.expenses / baseExpenses : 1;
          dataPoint[scenario.name] = baseNetResult * revenueRatio - (baseExpenses * (expenseRatio - 1));
          break;
        case 'ebitda':
          dataPoint[scenario.name] = applied.revenue - applied.expenses;
          break;
      }
    });

    return dataPoint;
  });

  // Get scenario colors
  const getScenarioColor = (scenario: Scenario) => {
    if (scenario.color) return scenario.color;
    switch (scenario.name.toLowerCase()) {
      case 'pessimiste': return 'hsl(0, 70%, 50%)';
      case 'réaliste': return 'hsl(220, 70%, 50%)';
      case 'optimiste': return 'hsl(142, 70%, 45%)';
      default: return 'hsl(200, 70%, 50%)';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            Comparaison des scénarios
          </CardTitle>
          <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">Chiffre d'affaires</SelectItem>
              <SelectItem value="netResult">Résultat net</SelectItem>
              <SelectItem value="ebitda">EBE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
            {scenarios.map((scenario) => (
              <Bar 
                key={scenario.id}
                dataKey={scenario.name}
                fill={getScenarioColor(scenario)}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>

        {/* Summary table */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Scénario</th>
                {plData.years.map((year) => (
                  <th key={year.label} className="text-right py-2 font-medium text-muted-foreground">
                    {year.label}
                  </th>
                ))}
                <th className="text-right py-2 font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((scenario) => {
                const values = chartData.map(d => d[scenario.name] || 0);
                const total = values.reduce((a, b) => a + b, 0);
                
                return (
                  <tr key={scenario.id} className="border-b border-border/50">
                    <td className="py-2 flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: getScenarioColor(scenario) }}
                      />
                      {scenario.name}
                    </td>
                    {values.map((value, i) => (
                      <td key={i} className="text-right py-2 font-mono">
                        {formatCurrency(value)}
                      </td>
                    ))}
                    <td className="text-right py-2 font-mono font-bold">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
