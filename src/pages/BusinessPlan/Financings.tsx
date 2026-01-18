import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Landmark, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FinancingTable } from '@/components/businessplan/FinancingTable';
import { FinancingDialog } from '@/components/businessplan/FinancingDialog';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { useFinancings, Financing } from '@/hooks/useFinancings';
import { useCurrentBusinessPlan } from '@/hooks/useCurrentBusinessPlan';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Financings() {
  const { isLoading: isLoadingBP } = useCurrentBusinessPlan();
  
  const [financingDialogOpen, setFinancingDialogOpen] = useState(false);
  const [selectedFinancing, setSelectedFinancing] = useState<Financing | null>(null);

  const { financings, createFinancing, updateFinancing, getTotalOutstandingLoans, getTotalMonthlyPayments } = useFinancings();

  const handleSaveFinancing = (data: Partial<Financing>) => {
    if (data.id) {
      updateFinancing.mutate(data as Financing);
    } else {
      createFinancing.mutate(data);
    }
  };

  const handleEditFinancing = (financing: Financing) => {
    setSelectedFinancing(financing);
    setFinancingDialogOpen(true);
  };

  const totalOutstanding = getTotalOutstandingLoans();
  const totalMonthlyPayments = getTotalMonthlyPayments();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

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
        title="Financements"
        subtitle="Gérez vos emprunts bancaires, crédits-bail et leasings"
        actions={
          <div className="flex gap-2">
            <BPExportDialog />
            <Button 
              className="gap-2"
              onClick={() => {
                setSelectedFinancing(null);
                setFinancingDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouveau financement
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Encours total</p>
              <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Mensualités totales</p>
              <p className="text-2xl font-bold">{formatCurrency(totalMonthlyPayments)}/mois</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Financings table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle>Financements en cours</CardTitle>
          </CardHeader>
          <CardContent>
            {financings.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Landmark className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Aucun financement</p>
                  <p className="text-sm">Emprunts bancaires, crédits-bail, leasing...</p>
                </div>
              </div>
            ) : (
              <FinancingTable onEdit={handleEditFinancing} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      <SectionNotes 
        section="financing" 
        title="Notes sur les financements"
        placeholder="Documentez vos sources de financement, conditions des emprunts, garanties..."
      />

      <FinancingDialog
        open={financingDialogOpen}
        onOpenChange={setFinancingDialogOpen}
        financing={selectedFinancing}
        onSave={handleSaveFinancing}
      />
    </div>
  );
}
