import { motion } from 'framer-motion';
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
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useBalanceChartData } from '@/hooks/useDashboardStats';
import { Skeleton } from '@/components/ui/skeleton';

export function BalanceChart() {
  const { data, loading } = useBalanceChartData();

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
          <p className="font-semibold text-foreground capitalize mb-2">{d.month}</p>
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
              <span className={`font-semibold ${d.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatTooltipValue(d.balance)}
              </span>
            </div>
          </div>
          {d.isProjection && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">📊 Projection</p>
          )}
        </div>
      );
    }
    return null;
  };

  // Calculate trend
  const pastData = data.filter(d => !d.isProjection);
  const futureData = data.filter(d => d.isProjection);
  const lastPastBalance = pastData[pastData.length - 1]?.balance || 0;
  const lastFutureBalance = futureData[futureData.length - 1]?.balance || lastPastBalance;
  const trendPercent = lastPastBalance > 0 
    ? ((lastFutureBalance - lastPastBalance) / lastPastBalance * 100).toFixed(0)
    : '0';
  const isPositiveTrend = Number(trendPercent) >= 0;

  const minBalance = data.length > 0 ? Math.min(...data.map(d => d.balance)) : 0;
  const maxBalance = data.length > 0 ? Math.max(...data.map(d => d.balance)) : 0;

  if (loading) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border shadow-card p-6"
      >
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-32 mb-6" />
        <Skeleton className="h-80 w-full" />
      </motion.div>
    );
  }

  if (data.length === 0) {
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border shadow-card p-6"
      >
        <h3 className="text-lg font-semibold text-foreground">Projection de trésorerie</h3>
        <p className="text-sm text-muted-foreground mb-6">Vision sur 12 mois glissants</p>
        <div className="h-80 flex items-center justify-center text-muted-foreground">
          Aucune donnée disponible. Synchronisez vos transactions pour commencer.
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-2xl border border-border shadow-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Projection de trésorerie</h3>
          <p className="text-sm text-muted-foreground">Vision sur 12 mois glissants</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
            <span>Solde</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm border-2 border-dashed border-muted-foreground/50" />
            <span>Prévisions</span>
          </div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            barGap={2}
          >
            <defs>
              <linearGradient id="dashIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="dashExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="dashIncomeForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="dashExpenseForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
              </linearGradient>
              <linearGradient id="dashBalanceNegArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              tickFormatter={(value) => value.split(' ')[0]}
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
                fontWeight: 600,
              }}
            />

            {/* Income bars */}
            <Bar dataKey="income" yAxisId="bars" radius={[4, 4, 0, 0]} maxBarSize={40} name="Encaissements">
              {data.map((entry, index) => (
                <Cell
                  key={`income-${index}`}
                  fill={!entry.isProjection ? 'url(#dashIncomeGradient)' : 'url(#dashIncomeForecast)'}
                  stroke={!entry.isProjection ? 'hsl(var(--success))' : 'hsl(var(--success) / 0.5)'}
                  strokeWidth={!entry.isProjection ? 0 : 1}
                  strokeDasharray={!entry.isProjection ? 'none' : '3 3'}
                />
              ))}
            </Bar>

            {/* Expense bars */}
            <Bar dataKey="expense" yAxisId="bars" radius={[4, 4, 0, 0]} maxBarSize={40} name="Décaissements">
              {data.map((entry, index) => (
                <Cell
                  key={`expense-${index}`}
                  fill={!entry.isProjection ? 'url(#dashExpenseGradient)' : 'url(#dashExpenseForecast)'}
                  stroke={!entry.isProjection ? 'hsl(var(--destructive))' : 'hsl(var(--destructive) / 0.5)'}
                  strokeWidth={!entry.isProjection ? 0 : 1}
                  strokeDasharray={!entry.isProjection ? 'none' : '3 3'}
                />
              ))}
            </Bar>

            {/* Negative balance area */}
            <Area
              type="monotone"
              dataKey={(d: any) => (d.balance < 0 ? d.balance : 0)}
              yAxisId="balance"
              fill="url(#dashBalanceNegArea)"
              stroke="none"
              baseValue={0}
              isAnimationActive={false}
            />

            {/* Balance line */}
            <Line
              type="monotone"
              dataKey="balance"
              yAxisId="balance"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              name="Solde fin de mois"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const isNegative = payload.balance < 0;
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
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Solde min prévu</p>
          <p className="text-lg font-semibold text-foreground">{formatTooltipValue(minBalance)}</p>
        </div>
        <div className="text-center border-x border-border">
          <p className="text-sm text-muted-foreground">Solde max prévu</p>
          <p className="text-lg font-semibold text-foreground">{formatTooltipValue(maxBalance)}</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Tendance</p>
          <p className={`text-lg font-semibold flex items-center justify-center gap-1 ${isPositiveTrend ? 'text-success' : 'text-destructive'}`}>
            {isPositiveTrend ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isPositiveTrend ? '+' : ''}{trendPercent}%
          </p>
        </div>
      </div>
    </motion.div>
  );
}
