import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestmentTable } from '@/components/businessplan/InvestmentTable';
import { InvestmentDialog } from '@/components/businessplan/InvestmentDialog';
import { useInvestments, Investment } from '@/hooks/useInvestments';

export default function Investments() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);

  const { investments, createInvestment, updateInvestment, getTotalGrossValue, getTotalAccumulatedDepreciation } = useInvestments();

  const handleSave = (data: Partial<Investment>) => {
    if (data.id) {
      updateInvestment.mutate(data as Investment & { id: string });
    } else {
      createInvestment.mutate(data);
    }
  };

  const handleEdit = (investment: Investment) => {
    setSelectedInvestment(investment);
    setDialogOpen(true);
  };

  const totalGross = getTotalGrossValue();
  const totalDepreciation = getTotalAccumulatedDepreciation(new Date());
  const totalNetValue = totalGross - totalDepreciation;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Investissements</h1>
          <p className="text-muted-foreground mt-1">Gérez vos immobilisations et suivez les amortissements</p>
        </div>
        <Button 
          className="gap-2"
          onClick={() => {
            setSelectedInvestment(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nouvel investissement
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Valeur brute totale</p>
              <p className="text-2xl font-bold">{formatCurrency(totalGross)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Amortissements cumulés</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDepreciation)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Valeur nette comptable</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalNetValue)}</p>
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
              <InvestmentTable onEdit={handleEdit} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      <InvestmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        investment={selectedInvestment}
        onSave={handleSave}
      />
    </div>
  );
}
