import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useScenarios } from '@/hooks/useScenarios';
import { useProfitLoss } from '@/hooks/useProfitLoss';
import { ScenarioCard } from '@/components/businessplan/ScenarioCard';
import { ScenarioDialog } from '@/components/businessplan/ScenarioDialog';
import { ScenarioComparisonChart } from '@/components/businessplan/ScenarioComparisonChart';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { Download } from 'lucide-react';

export default function Scenarios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { scenarios, isLoading, applyScenario, createScenario, updateScenario, deleteScenario } = useScenarios();
  const { data: plData } = useProfitLoss();

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  // Calculate totals for display
  const getTotalForScenario = (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return { revenue: 0, expenses: 0, result: 0 };

    const totalRevenue = plData.totals.revenue.reduce((a, b) => a + b, 0);
    const totalExpenses = (plData.totals.fixedExpenses.reduce((a, b) => a + b, 0)) +
                          (plData.totals.variableExpenses.reduce((a, b) => a + b, 0)) +
                          (plData.totals.personnelCosts.reduce((a, b) => a + b, 0)) +
                          (plData.totals.directorsCosts.reduce((a, b) => a + b, 0));

    return applyScenario(scenario, totalRevenue, totalExpenses);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scénarios</h1>
          <p className="text-muted-foreground mt-1">Comparez différentes hypothèses de croissance</p>
        </div>
        <div className="flex gap-2">
          <BPExportDialog 
            trigger={
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exporter
              </Button>
            }
          />
          <Button className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouveau scénario
          </Button>
        </div>
      </div>

      {/* Scenario Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {scenarios.map((scenario, index) => (
          <motion.div
            key={scenario.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <ScenarioCard
              scenario={scenario}
              projectedResult={formatCurrency(getTotalForScenario(scenario.id).result)}
              onEdit={() => {}}
              onDelete={() => deleteScenario.mutate(scenario.id)}
            />
          </motion.div>
        ))}
      </div>

      {/* Comparison Chart */}
      <ScenarioComparisonChart />

      {/* Notes */}
      <SectionNotes 
        section="scenarios" 
        title="Notes sur les scénarios"
        placeholder="Décrivez les hypothèses derrière chaque scénario..."
      />

      <ScenarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={(data) => createScenario.mutate(data)}
      />
    </div>
  );
}
