import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useBalanceChartData } from '@/hooks/useDashboardStats';
import { Skeleton } from '@/components/ui/skeleton';

export function BalanceChart() {
  const { data, loading } = useBalanceChartData();

  const formatValue = (value: number) => {
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
        <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
          <p className="font-semibold text-foreground mb-2">{label}</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Solde</span>
              <span className="font-semibold text-foreground">{formatValue(data.balance)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-success">Encaissements</span>
              <span className="font-medium text-success">{formatValue(data.income)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-destructive">Décaissements</span>
              <span className="font-medium text-destructive">{formatValue(data.expense)}</span>
            </div>
          </div>
          {data.isProjection && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
              📊 Projection
            </p>
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

  const minBalance = Math.min(...data.map(d => d.balance));
  const maxBalance = Math.max(...data.map(d => d.balance));

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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Réalisé</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary/40 border border-primary border-dashed" />
            <span className="text-sm text-muted-foreground">Prévision</span>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
              tickFormatter={(value) => value.split(' ')[0]}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="hsl(0, 84%, 60%)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={3}
              fill="url(#balanceGradient)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.isProjection) {
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="white"
                      stroke="hsl(221, 83%, 53%)"
                      strokeWidth={2}
                      strokeDasharray="2 2"
                    />
                  );
                }
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="hsl(221, 83%, 53%)"
                    stroke="white"
                    strokeWidth={2}
                  />
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Solde min prévu</p>
          <p className="text-lg font-semibold text-foreground">{formatValue(minBalance)}</p>
        </div>
        <div className="text-center border-x border-border">
          <p className="text-sm text-muted-foreground">Solde max prévu</p>
          <p className="text-lg font-semibold text-foreground">{formatValue(maxBalance)}</p>
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
