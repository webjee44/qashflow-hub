import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRevenueStreams, RevenueStream } from '@/hooks/useRevenueStreams';
import { RevenueStreamDialog } from '@/components/businessplan/RevenueStreamDialog';
import { RevenueTable } from '@/components/businessplan/RevenueTable';

export default function RevenueAssumptions() {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hypothèses de Revenus</h1>
          <p className="text-muted-foreground mt-1">Définissez vos flux de revenus et projections</p>
        </div>
        <Button className="gap-2" onClick={handleNewStream}>
          <Plus className="h-4 w-4" />
          Ajouter un flux
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
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

      <RevenueStreamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        stream={editingStream}
        onSave={handleSave}
      />
    </div>
  );
}
