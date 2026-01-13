import { motion } from 'framer-motion';
import { TrendingUp, Target, PiggyBank, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BPDashboard() {
  const kpis = [
    { 
      title: "CA Annuel Prévu", 
      value: "0 €", 
      icon: TrendingUp, 
      trend: "+0%",
      color: "text-primary" 
    },
    { 
      title: "Marge Brute", 
      value: "0%", 
      icon: Target, 
      trend: "-",
      color: "text-success" 
    },
    { 
      title: "Résultat Net", 
      value: "0 €", 
      icon: PiggyBank, 
      trend: "-",
      color: "text-warning" 
    },
    { 
      title: "Point Mort", 
      value: "- mois", 
      icon: Calendar, 
      trend: "-",
      color: "text-secondary" 
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Business Plan</h1>
        <p className="text-muted-foreground mt-1">Vue d'ensemble de vos projections financières</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.trend}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Placeholder for charts */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution du P&L</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Aucune donnée</p>
            <p className="text-sm">Commencez par définir vos hypothèses de revenus</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
