import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Package, Landmark, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestmentTable } from '@/components/businessplan/InvestmentTable';
import { InvestmentDialog } from '@/components/businessplan/InvestmentDialog';
import { FinancingTable } from '@/components/businessplan/FinancingTable';
import { FinancingDialog } from '@/components/businessplan/FinancingDialog';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { useInvestments, Investment } from '@/hooks/useInvestments';
import { useFinancings, Financing } from '@/hooks/useFinancings';
import { useCurrentBusinessPlan } from '@/hooks/useCurrentBusinessPlan';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Investments() {
  const { isLoading: isLoadingBP } = useCurrentBusinessPlan();
  
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [financingDialogOpen, setFinancingDialogOpen] = useState(false);
  const [selectedFinancing, setSelectedFinancing] = useState<Financing | null>(null);

  const { investments, createInvestment, updateInvestment, getTotalGrossValue, getTotalAccumulatedDepreciation } = useInvestments();
  const { financings, createFinancing, updateFinancing, getTotalOutstandingLoans, getTotalMonthlyPayments } = useFinancings();

  const handleSaveInvestment = (data: Partial<Investment>) => {
    if (data.id) {
      updateInvestment.mutate(data as Investment & { id: string });
    } else {
      createInvestment.mutate(data);
    }
  };

  const handleEditInvestment = (investment: Investment) => {
    setSelectedInvestment(investment);
    setInvestmentDialogOpen(true);
  };

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

  const totalGross = getTotalGrossValue();
  const totalDepreciation = getTotalAccumulatedDepreciation(new Date());
  const totalNetValue = totalGross - totalDepreciation;
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
        title="Investissements & Financements"
        subtitle="Gérez vos immobilisations, emprunts et leasings"
        actions={
          <div className="flex gap-2">
            <BPExportDialog />
            <Button 
              variant="outline"
              className="gap-2"
              onClick={() => {
                setSelectedFinancing(null);
                setFinancingDialogOpen(true);
              }}
            >
              <Landmark className="h-4 w-4" />
              Nouveau financement
            </Button>
            <Button 
              className="gap-2"
              onClick={() => {
                setSelectedInvestment(null);
                setInvestmentDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nouvel investissement
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Valeur brute</p>
              <p className="text-2xl font-bold">{formatCurrency(totalGross)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Amortissements</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDepreciation)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">VNC totale</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalNetValue)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Encours emprunts</p>
              <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Mensualités</p>
              <p className="text-2xl font-bold">{formatCurrency(totalMonthlyPayments)}/mois</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Investments table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader>
            <CardTitle>Tableau des immobilisations</CardTitle>
          </CardHeader>
          <CardContent>
            {investments.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Package className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Aucune immobilisation</p>
                  <p className="text-sm">Matériel, véhicules, logiciels, mobilier...</p>
                </div>
              </div>
            ) : (
              <InvestmentTable onEdit={handleEditInvestment} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Financings table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
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
        section="investments" 
        title="Notes sur les investissements"
        placeholder="Documentez vos projets d'investissement, modes de financement envisagés..."
      />

      <InvestmentDialog
        open={investmentDialogOpen}
        onOpenChange={setInvestmentDialogOpen}
        investment={selectedInvestment}
        onSave={handleSaveInvestment}
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
