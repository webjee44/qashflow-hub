import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Target, Sparkles, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Scenario } from '@/hooks/useScenarios';
import { useProfitLoss } from '@/hooks/useProfitLoss';

interface ScenarioCardProps {
  scenario: Scenario;
  onEdit: () => void;
  onDelete: () => void;
}

const ICONS: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  TrendingDown: <TrendingDown className="h-5 w-5" />,
  Target: <Target className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
};

export function ScenarioCard({ scenario, onEdit, onDelete }: ScenarioCardProps) {
  const { data } = useProfitLoss();
  
  // Calculate Year 1 data for scenario comparison
  const year1Revenue = data.totals.revenue[0] || 0;
  const year1Expenses = (
    (data.totals.fixedExpenses[0] || 0) + 
    (data.totals.variableExpenses[0] || 0) + 
    (data.totals.personnelCosts[0] || 0) + 
    (data.totals.directorsCosts[0] || 0) +
    (data.totals.depreciation[0] || 0) +
    (data.totals.leaseExpenses[0] || 0)
  );
  const year1Result = (year1Revenue * Number(scenario.revenue_multiplier)) - 
                      (year1Expenses * Number(scenario.expense_multiplier));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (multiplier: number) => {
    const diff = (multiplier - 1) * 100;
    if (diff === 0) return '–';
    return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="relative group">
        {!scenario.is_default && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: scenario.color || 'hsl(var(--primary))', color: 'white' }}
            >
              {ICONS[scenario.icon] || <Sparkles className="h-5 w-5" />}
            </div>
            <div>
              <CardTitle className="text-lg">{scenario.name}</CardTitle>
              {scenario.is_default && (
                <Badge variant="secondary" className="mt-1">Par défaut</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Revenus</p>
              <p className="text-sm font-semibold">{formatPercent(Number(scenario.revenue_multiplier))}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Charges</p>
              <p className="text-sm font-semibold">{formatPercent(Number(scenario.expense_multiplier))}</p>
            </div>
          </div>

          <div className="pt-3 border-t space-y-2">
            <p className="text-xs text-muted-foreground font-medium mb-2">Année 1</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CA projeté</span>
              <span className="font-medium text-success">{formatCurrency(year1Revenue * Number(scenario.revenue_multiplier))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Charges projetées</span>
              <span className="font-medium text-destructive">{formatCurrency(year1Expenses * Number(scenario.expense_multiplier))}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-medium">Résultat A1</span>
              <span className={`font-bold ${year1Result >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(year1Result)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
