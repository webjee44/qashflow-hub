import { motion } from 'framer-motion';
import { TrendingUp, Target, PiggyBank, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProfitLoss } from '@/hooks/useProfitLoss';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function BPDashboard() {
  const { data, getBreakEvenMonth, getGrossMargin, isLoading } = useProfitLoss();

  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  const breakEven = getBreakEvenMonth();

  const kpis = [
    { title: "CA Annuel Prévu", value: formatCurrency(data.annualSummary.revenue), icon: TrendingUp, color: "text-success" },
    { title: "Marge Brute", value: `${getGrossMargin().toFixed(1)}%`, icon: Target, color: "text-primary" },
    { title: "Résultat Net", value: formatCurrency(data.annualSummary.netResult), icon: PiggyBank, color: data.annualSummary.netResult >= 0 ? "text-success" : "text-destructive" },
    { title: "Point Mort", value: breakEven ? `${breakEven} mois` : "–", icon: Calendar, color: "text-secondary" },
  ];

  const chartData = data.months.slice(0, 12).map((month, i) => ({
    month: format(month, 'MMM', { locale: fr }),
    Revenus: data.totals.revenue[i],
    Charges: data.totals.fixedExpenses[i] + data.totals.personnelCosts[i],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Business Plan</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de vos projections financières</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div key={kpi.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Évolution Revenus vs Charges</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="Revenus" fill="hsl(142, 70%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Charges" fill="hsl(0, 70%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
