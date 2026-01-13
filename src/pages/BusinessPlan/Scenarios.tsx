import { motion } from 'framer-motion';
import { Plus, GitBranch, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Scenarios() {
  const defaultScenarios = [
    { 
      name: "Pessimiste", 
      revenueMultiplier: 0.7, 
      expenseMultiplier: 1.1,
      icon: TrendingDown,
      color: "text-destructive"
    },
    { 
      name: "Réaliste", 
      revenueMultiplier: 1.0, 
      expenseMultiplier: 1.0,
      icon: Minus,
      color: "text-primary"
    },
    { 
      name: "Optimiste", 
      revenueMultiplier: 1.3, 
      expenseMultiplier: 0.9,
      icon: TrendingUp,
      color: "text-success"
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scénarios</h1>
          <p className="text-muted-foreground mt-1">Comparez différentes hypothèses de croissance</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau scénario
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {defaultScenarios.map((scenario, index) => (
          <motion.div
            key={scenario.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${scenario.color}`}>
                  <scenario.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{scenario.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Revenus</span>
                  <span className="font-medium">
                    {scenario.revenueMultiplier > 1 ? '+' : ''}
                    {((scenario.revenueMultiplier - 1) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Charges</span>
                  <span className="font-medium">
                    {scenario.expenseMultiplier > 1 ? '+' : ''}
                    {((scenario.expenseMultiplier - 1) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Résultat projeté</p>
                    <p className="text-lg font-bold">0 €</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparaison des scénarios</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <GitBranch className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Graphique comparatif</p>
            <p className="text-sm">Visualisez l'impact de chaque scénario sur votre P&L</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
