import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BPCashFlowChart } from '@/components/businessplan/BPCashFlowChart';
import { BPSettingsDialog } from '@/components/businessplan/BPSettingsDialog';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { useBPCashFlow } from '@/hooks/useBPCashFlow';
import { useBPSettings } from '@/hooks/useBPSettings';

export default function CashFlow() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data, isHealthy, getMinimumInitialCash } = useBPCashFlow();
  const { settings } = useBPSettings();

  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Trésorerie Prévisionnelle</h1>
          <p className="text-muted-foreground mt-1">Projection du cash-flow basée sur le Business Plan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
            Paramètres
          </Button>
          <BPExportDialog />
        </div>
      </div>

      {!isHealthy() && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Attention : votre trésorerie devient négative. Besoin minimum de {formatCurrency(getMinimumInitialCash())} en trésorerie initiale.
          </AlertDescription>
        </Alert>
      )}

      {isHealthy() && data.balance.some(b => b > 0) && (
        <Alert className="border-success/50 bg-success/10">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription className="text-success">Votre trésorerie reste positive sur toute la période.</AlertDescription>
        </Alert>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader><CardTitle>Évolution de la trésorerie</CardTitle></CardHeader>
          <CardContent><BPCashFlowChart /></CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader><CardTitle>Paramètres de trésorerie</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground">Trésorerie initiale</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(settings.initial_cash)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground">Délai paiement clients</p>
              <p className="text-2xl font-bold text-foreground">{settings.customer_payment_delay} jours</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground">Délai paiement fournisseurs</p>
              <p className="text-2xl font-bold text-foreground">{settings.supplier_payment_delay} jours</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <SectionNotes 
        section="cash_flow" 
        title="Notes sur la trésorerie"
        placeholder="Documentez vos hypothèses de délais de paiement, saisonnalité des encaissements..."
      />

      <BPSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
