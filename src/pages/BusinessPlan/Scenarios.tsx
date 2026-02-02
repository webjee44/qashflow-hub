import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, Camera, History, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useScenarios, Scenario } from '@/hooks/useScenarios';
import { useBPSnapshots, BPSnapshot } from '@/hooks/useBPSnapshots';
import { useProfitLoss } from '@/hooks/useProfitLoss';
import { ScenarioCard, SnapshotCard, SectionNotes } from '@/features/business-plan/components';
import { ScenarioComparisonChart } from '@/features/business-plan/charts';
import { ScenarioDialog, ScenarioOverridesDialog, SnapshotDialog, SnapshotCompareDialog, BPExportDialog } from '@/features/business-plan/dialogs';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Scenarios() {
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [overridesDialogOpen, setOverridesDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<BPSnapshot | null>(null);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  
  const { scenarios, isLoading, createScenario, updateScenario, deleteScenario } = useScenarios();
  const { snapshots, createSnapshot, deleteSnapshot } = useBPSnapshots();
  const { data: plData } = useProfitLoss();

  const handleEditScenario = (scenario: Scenario) => {
    setEditingScenario(scenario);
    setScenarioDialogOpen(true);
  };

  const handleOpenOverrides = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setOverridesDialogOpen(true);
  };

  const handleCompareSnapshot = (snapshot: BPSnapshot) => {
    setSelectedSnapshot(snapshot);
    setCompareDialogOpen(true);
  };

  const handleSaveScenario = (data: Partial<Scenario>) => {
    if (editingScenario) {
      updateScenario.mutate({ id: editingScenario.id, ...data });
    } else {
      createScenario.mutate(data);
    }
    setEditingScenario(null);
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Scénarios & Versions"
        subtitle="Comparez différentes hypothèses et gérez les versions de votre business plan"
        actions={
          <div className="flex gap-2">
            <BPExportDialog 
              trigger={
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exporter
                </Button>
              }
            />
          </div>
        }
      />

      <Tabs defaultValue="scenarios" className="space-y-6">
        <TabsList>
          <TabsTrigger value="scenarios" className="gap-2">
            <Sliders className="h-4 w-4" />
            Scénarios
          </TabsTrigger>
          <TabsTrigger value="snapshots" className="gap-2">
            <History className="h-4 w-4" />
            Versions ({snapshots.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-6">
          {/* Actions */}
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => {
              setEditingScenario(null);
              setScenarioDialogOpen(true);
            }}>
              <Plus className="h-4 w-4" />
              Nouveau scénario
            </Button>
          </div>

          {/* Scenario Cards */}
          <div data-tour-bp="scenarios-grid" className="grid gap-4 md:grid-cols-3">
            {scenarios.map((scenario, index) => (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative group"
              >
                <ScenarioCard
                  scenario={scenario}
                  onEdit={() => handleEditScenario(scenario)}
                  onDelete={() => deleteScenario.mutate(scenario.id)}
                />
                {/* Variations button */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-3 right-3 gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleOpenOverrides(scenario)}
                >
                  <Sliders className="h-3 w-3" />
                  Variations
                </Button>
              </motion.div>
            ))}
          </div>

          {/* Comparison Chart */}
          <ScenarioComparisonChart />
        </TabsContent>

        <TabsContent value="snapshots" className="space-y-6">
          {/* Actions */}
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setSnapshotDialogOpen(true)}>
              <Camera className="h-4 w-4" />
              Créer un snapshot
            </Button>
          </div>

          {/* Snapshots Grid */}
          {snapshots.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Aucune version sauvegardée</p>
              <p className="text-sm mt-1">
                Créez un snapshot pour sauvegarder l'état actuel de votre business plan
              </p>
              <Button 
                className="mt-4 gap-2" 
                onClick={() => setSnapshotDialogOpen(true)}
              >
                <Camera className="h-4 w-4" />
                Créer un snapshot
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {snapshots.map((snapshot, index) => (
                <motion.div
                  key={snapshot.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <SnapshotCard
                    snapshot={snapshot}
                    onCompare={() => handleCompareSnapshot(snapshot)}
                    onDelete={() => deleteSnapshot.mutate(snapshot.id)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Notes */}
      <SectionNotes 
        section="scenarios" 
        title="Notes sur les scénarios"
        placeholder="Décrivez les hypothèses derrière chaque scénario..."
      />

      {/* Dialogs */}
      <ScenarioDialog
        open={scenarioDialogOpen}
        onOpenChange={(open) => {
          setScenarioDialogOpen(open);
          if (!open) setEditingScenario(null);
        }}
        scenario={editingScenario}
        onSave={handleSaveScenario}
      />

      <SnapshotDialog
        open={snapshotDialogOpen}
        onOpenChange={setSnapshotDialogOpen}
        onSave={(data) => createSnapshot.mutate(data)}
      />

      {selectedScenario && (
        <ScenarioOverridesDialog
          open={overridesDialogOpen}
          onOpenChange={setOverridesDialogOpen}
          scenario={selectedScenario}
        />
      )}

      <SnapshotCompareDialog
        open={compareDialogOpen}
        onOpenChange={setCompareDialogOpen}
        snapshot={selectedSnapshot}
      />
    </div>
  );
}
