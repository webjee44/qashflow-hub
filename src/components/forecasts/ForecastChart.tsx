import { useMemo } from 'react';
import { format, isBefore, startOfMonth, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';

interface ClosingBalanceData {
  balance: number;
  forecastBalance?: number | null;
}

interface ForecastChartProps {
  months: Date[];
  getMonthTotal: (type: 'income' | 'expense', monthIndex: number, valueType: 'forecast' | 'actual') => number;
  getClosingBalance: (month: Date) => ClosingBalanceData;
  getUncategorized?: (type: 'income' | 'expense', month: Date) => number;
  getNetVatForecast?: (month: Date) => number;
}

export function ForecastChart({ months, getMonthTotal, getClosingBalance, getUncategorized, getNetVatForecast }: ForecastChartProps) {
  const today = startOfMonth(new Date());

  const data = useMemo(() => {
    return months.map((month, index) => {
      const isPast = isBefore(month, today);
      const isCurrent = isSameMonth(month, today);
      const isActualPeriod = isPast || isCurrent;
      
      let income = getMonthTotal('income', index, isActualPeriod ? 'actual' : 'forecast');
      let expense = getMonthTotal('expense', index, isActualPeriod ? 'actual' : 'forecast');
      
      // Include uncategorized transactions in actual bars
      if (isActualPeriod && getUncategorized) {
        income += getUncategorized('income', month);
        expense += getUncategorized('expense', month);
      }
      
      if (!isActualPeriod && getPayableOutflow) {
        expense += getPayableOutflow(month);
      }

      // Get real closing balance from the forecast engine
      const closingData = getClosingBalance(month);
      const endBalance = (isCurrent && closingData.forecastBalance != null)
        ? closingData.forecastBalance
        : closingData.balance;
      
      return {
        month: format(month, 'MMM', { locale: fr }),
        fullMonth: format(month, 'MMMM yyyy', { locale: fr }),
        income,
        expense,
        endBalance,
        isPast: isActualPeriod,
      };
    });
  }, [months, getMonthTotal, getPayableOutflow, getClosingBalance, getUncategorized, today]);

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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-semibold text-foreground capitalize mb-2">{d.fullMonth}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-success" />
              <span className="text-muted-foreground">Encaissements:</span>
              <span className="font-medium text-success">{formatTooltipValue(d.income)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-destructive" />
              <span className="text-muted-foreground">Décaissements:</span>
              <span className="font-medium text-destructive">{formatTooltipValue(d.expense)}</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <div className="w-3 h-0.5 bg-primary rounded" />
              <span className="text-muted-foreground">Solde fin de mois:</span>
              <span className={`font-semibold ${d.endBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatTooltipValue(d.endBalance)}
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
        <div className="h-[220px] w-full">
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
                <linearGradient id="balanceNegativeArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
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
                yAxisId="bars"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatValue}
                width={50}
              />
              <YAxis 
                yAxisId="balance"
                orientation="right"
                tick={{ fill: 'hsl(var(--primary))', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatValue}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine 
                yAxisId="balance" 
                y={0} 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2} 
                strokeDasharray="6 3"
                label={{ 
                  value: '0 €', 
                  position: 'right', 
                  fill: 'hsl(var(--destructive))', 
                  fontSize: 11, 
                  fontWeight: 600 
                }}
              />
              
              {/* Income bars */}
              <Bar 
                dataKey="income" 
                yAxisId="bars"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                name="Encaissements"
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
                yAxisId="bars"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
                name="Décaissements"
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
              
              {/* Negative balance area fill */}
              <Area
                type="monotone"
                dataKey={(d: any) => d.endBalance < 0 ? d.endBalance : 0}
                yAxisId="balance"
                fill="url(#balanceNegativeArea)"
                stroke="none"
                baseValue={0}
                isAnimationActive={false}
              />
              
              {/* End-of-month balance line */}
              <Line 
                type="monotone"
                dataKey="endBalance"
                yAxisId="balance"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                name="Solde fin de mois"
                label={({ x, y, value }: any) => {
                  const formatted = Math.abs(value) >= 1000
                    ? `${(value / 1000).toFixed(0)}k`
                    : `${value.toFixed(0)}`;
                  return (
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      fill={value < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                      fontSize={10}
                      fontWeight={600}
                    >
                      {formatted} €
                    </text>
                  );
                }}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isNegative = payload.endBalance < 0;
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={isNegative ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  );
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
            <span>Encaissements</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-destructive" />
            <span>Décaissements</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-primary rounded" />
            <span>Solde fin de mois</span>
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
