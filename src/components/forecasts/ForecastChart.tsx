import { useMemo } from 'react';
import { format, isBefore, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';

interface ForecastChartProps {
  months: Date[];
  getMonthTotal: (type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => number;
  getMonthVat: (type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => number;
  getPayableOutflow?: (month: Date) => number;
}

export function ForecastChart({ months, getMonthTotal, getMonthVat, getPayableOutflow }: ForecastChartProps) {
  const today = startOfMonth(new Date());

  const data = useMemo(() => {
    let cumulativeBalance = 0;
    
    return months.map((month, index) => {
      const isPast = isBefore(month, today);
      
      // Get totals TTC
      const incomeHt = getMonthTotal('income', index, isPast ? 'actual' : 'forecast');
      const expenseHt = getMonthTotal('expense', index, isPast ? 'actual' : 'forecast');
      const incomeVat = getMonthVat('income', index, isPast ? 'actual' : 'forecast');
      const expenseVat = getMonthVat('expense', index, isPast ? 'actual' : 'forecast');
      
      const incomeTtc = incomeHt + incomeVat;
      let expenseTtc = expenseHt + expenseVat;
      
      // Add payables to expenses for forecast months
      if (!isPast && getPayableOutflow) {
        expenseTtc += getPayableOutflow(month);
      }
      
      const netFlow = incomeTtc - expenseTtc;
      
      cumulativeBalance += netFlow;
      
      return {
        month: format(month, 'MMM', { locale: fr }),
        fullMonth: format(month, 'MMMM yyyy', { locale: fr }),
        income: incomeTtc,
        expense: expenseTtc,
        balance: cumulativeBalance,
        isPast,
      };
    });
  }, [months, getMonthTotal, getMonthVat, getPayableOutflow, today]);

  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toFixed(0);
  };

  const formatTooltipValue = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold text-foreground capitalize mb-2">{data.fullMonth}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-success" />
              <span className="text-muted-foreground">Revenus:</span>
              <span className="font-medium text-success">{formatTooltipValue(data.income)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-destructive" />
              <span className="text-muted-foreground">Dépenses:</span>
              <span className="font-medium text-destructive">{formatTooltipValue(data.expense)}</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <div className="w-3 h-0.5 bg-primary rounded" />
              <span className="text-muted-foreground">Solde cumulé:</span>
              <span className={`font-semibold ${data.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatTooltipValue(data.balance)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              barGap={2}
            >
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="incomeForecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="expenseForecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
              />
              <XAxis 
                dataKey="month" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatValue}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
              
              {/* Income bars */}
              <Bar 
                dataKey="income" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`income-${index}`}
                    fill={entry.isPast ? 'url(#incomeGradient)' : 'url(#incomeForecastGradient)'}
                    stroke={entry.isPast ? 'hsl(var(--success))' : 'hsl(var(--success) / 0.5)'}
                    strokeWidth={entry.isPast ? 0 : 1}
                    strokeDasharray={entry.isPast ? 'none' : '3 3'}
                  />
                ))}
              </Bar>
              
              {/* Expense bars */}
              <Bar 
                dataKey="expense" 
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`expense-${index}`}
                    fill={entry.isPast ? 'url(#expenseGradient)' : 'url(#expenseForecastGradient)'}
                    stroke={entry.isPast ? 'hsl(var(--destructive))' : 'hsl(var(--destructive) / 0.5)'}
                    strokeWidth={entry.isPast ? 0 : 1}
                    strokeDasharray={entry.isPast ? 'none' : '3 3'}
                  />
                ))}
              </Bar>
              
              {/* Balance line */}
              <Line 
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ 
                  fill: 'hsl(var(--primary))', 
                  stroke: 'hsl(var(--background))',
                  strokeWidth: 2,
                  r: 4
                }}
                activeDot={{ 
                  r: 6, 
                  fill: 'hsl(var(--primary))',
                  stroke: 'hsl(var(--background))',
                  strokeWidth: 2
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-success" />
            <span>Revenus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-destructive" />
            <span>Dépenses</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-primary rounded" />
            <span>Solde cumulé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border-2 border-dashed border-muted-foreground/50" />
            <span>Prévisions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}