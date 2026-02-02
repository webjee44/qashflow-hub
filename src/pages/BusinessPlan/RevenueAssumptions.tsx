import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRevenueStreams, RevenueStream } from '@/hooks/useRevenueStreams';
import { useCurrentBusinessPlan } from '@/hooks/useCurrentBusinessPlan';
import { RevenueTable, RevenueSummaryCard, SectionNotes } from '@/features/business-plan/components';
import { RevenueStreamDialog, BPExportDialog } from '@/features/business-plan/dialogs';
import { PageHeader } from '@/components/layout/PageHeader';

export default function RevenueAssumptions() {
  const { currentPlan, isLoading: isLoadingBP } = useCurrentBusinessPlan();
  const { streams, createStream, updateStream, isLoading } = useRevenueStreams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStream, setEditingStream] = useState<RevenueStream | null>(null);

  const handleSave = async (data: Partial<RevenueStream>) => {
    if (data.id) {
      await updateStream.mutateAsync({ id: data.id, ...data });
    } else {
      await createStream.mutateAsync(data);
    }
  };

  const handleEdit = (stream: RevenueStream) => {
    setEditingStream(stream);
    setDialogOpen(true);
  };

  const handleNewStream = () => {
    setEditingStream(null);
    setDialogOpen(true);
  };

  if (isLoadingBP) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hypothèses de Revenus"
        subtitle="Définissez vos flux de revenus et projections"
        actions={
          <div className="flex gap-2">
            <BPExportDialog />
            <Button 
              data-tour-bp="add-revenue"
              className="gap-2" 
              onClick={handleNewStream}
            >
              <Plus className="h-4 w-4" />
              Ajouter un flux
            </Button>
          </div>
        }
      />

      {/* Revenue Summary Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <RevenueSummaryCard />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card data-tour-bp="revenue-table">
          <CardHeader>
            <CardTitle>Flux de revenus</CardTitle>
          </CardHeader>
          <CardContent>
            {streams.length === 0 && !isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Aucun flux de revenus</p>
                  <p className="text-sm mb-4">Créez votre premier flux pour commencer</p>
                  <Button variant="outline" className="gap-2" onClick={handleNewStream}>
                    <Plus className="h-4 w-4" />
                    Ajouter un flux de revenus
                  </Button>
                </div>
              </div>
            ) : (
              <RevenueTable onEditStream={handleEdit} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      <SectionNotes 
        section="revenue" 
        title="Notes sur les revenus"
        placeholder="Documentez vos hypothèses de croissance, saisonnalité, segments de marché..."
      />

      <RevenueStreamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stream={editingStream}
        onSave={handleSave}
      />
    </div>
  );
}
