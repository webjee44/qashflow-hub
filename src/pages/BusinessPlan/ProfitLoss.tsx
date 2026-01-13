import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfitLossTable } from '@/components/businessplan/ProfitLossTable';
import { useProfitLoss } from '@/hooks/useProfitLoss';

export default function ProfitLoss() {
  const { data } = useProfitLoss();

  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Compte de Résultat</h1>
          <p className="text-muted-foreground mt-1">P&L prévisionnel basé sur vos hypothèses</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exporter
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">CA Annuel</p><p className="text-2xl font-bold text-success">{formatCurrency(data.annualSummary.revenue)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Charges Fixes</p><p className="text-2xl font-bold text-destructive">{formatCurrency(data.annualSummary.fixedExpenses)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Personnel</p><p className="text-2xl font-bold text-destructive">{formatCurrency(data.annualSummary.personnelCosts)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Résultat Net</p><p className={`text-2xl font-bold ${data.annualSummary.netResult >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(data.annualSummary.netResult)}</p></CardContent></Card>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader><CardTitle>P&L Prévisionnel</CardTitle></CardHeader>
          <CardContent><ProfitLossTable /></CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
