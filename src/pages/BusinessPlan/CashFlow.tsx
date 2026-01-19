import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Settings, AlertTriangle, CheckCircle, TrendingDown, TrendingUp, Wallet, Calendar, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BPCashFlowChart } from '@/components/businessplan/BPCashFlowChart';
import { BPCashFlowTable } from '@/components/businessplan/BPCashFlowTable';
import { BPSettingsDialog } from '@/components/businessplan/BPSettingsDialog';
import { SectionNotes } from '@/components/businessplan/SectionNotes';
import { BPExportDialog } from '@/components/businessplan/BPExportDialog';
import { useBPCashFlow } from '@/hooks/useBPCashFlow';
import { useBPSettings } from '@/hooks/useBPSettings';
import { PageHeader } from '@/components/layout/PageHeader';
import { Loader2 } from 'lucide-react';

export default function CashFlow() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data, isLoading, isHealthy, getMinimumInitialCash } = useBPCashFlow();
  const { settings } = useBPSettings();

  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'EUR', 
    maximumFractionDigits: 0 
  }).format(value);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const healthStatus = isHealthy();
  const minimumCashNeeded = getMinimumInitialCash();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trésorerie Prévisionnelle"
        subtitle="Projection des flux de trésorerie basée sur le Business Plan"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
              Paramètres
            </Button>
            <BPExportDialog />
          </div>
        }
      />

      {/* Alertes */}
      {!healthStatus && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Attention : Trésorerie négative détectée</AlertTitle>
          <AlertDescription className="mt-2">
            Votre trésorerie devient négative sur {data.monthsWithNegativeBalance} mois. 
            {data.lowestMonth && (
              <span className="block mt-1">
                Point le plus bas : <strong>{formatCurrency(data.lowestMonth.balance)}</strong> en{' '}
                <strong>{format(data.lowestMonth.month, 'MMMM yyyy', { locale: fr })}</strong>.
              </span>
            )}
            <span className="block mt-1">
              Besoin minimum de trésorerie initiale : <strong>{formatCurrency(minimumCashNeeded)}</strong>
            </span>
          </AlertDescription>
        </Alert>
      )}

      {healthStatus && data.balance.some(b => b > 0) && (
        <Alert className="border-success/50 bg-success/10">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription className="text-success">
            Votre trésorerie reste positive sur toute la période prévisionnelle.
          </AlertDescription>
        </Alert>
      )}

      {/* Cartes résumé */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trésorerie initiale</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(data.initialBalance)}
              </div>
              <p className="text-xs text-muted-foreground">
                Délai clients : {settings.customer_payment_delay} jours
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className={data.minBalance < 0 ? 'border-destructive/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Point le plus bas</CardTitle>
              <TrendingDown className={`h-4 w-4 ${data.minBalance < 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.minBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>
                {formatCurrency(data.minBalance)}
              </div>
              {data.lowestMonth && (
                <p className="text-xs text-muted-foreground">
                  {format(data.lowestMonth.month, 'MMMM yyyy', { locale: fr })}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trésorerie finale</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.finalBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(data.finalBalance)}
              </div>
              <p className="text-xs text-muted-foreground">
                À l'issue du BP ({settings.bp_years} ans)
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className={data.monthsWithNegativeBalance > 0 ? 'border-destructive/50' : 'border-success/50'}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mois en négatif</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.monthsWithNegativeBalance > 0 ? 'text-destructive' : 'text-success'}`}>
                {data.monthsWithNegativeBalance}
              </div>
              <p className="text-xs text-muted-foreground">
                sur {data.months.length} mois de projection
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Totaux encaissements/décaissements */}
      <div className="grid gap-4 md:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total encaissements</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(data.totalInflows)}
              </div>
              <p className="text-xs text-muted-foreground">
                CA encaissé + financements + apports
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total décaissements</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(data.totalOutflows)}
              </div>
              <p className="text-xs text-muted-foreground">
                Charges + personnel + investissements + remboursements
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Graphique et tableau */}
      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chart">Graphique</TabsTrigger>
          <TabsTrigger value="table">Tableau détaillé</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chart">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Évolution de la trésorerie</CardTitle>
                <CardDescription>
                  Encaissements et décaissements mensuels avec solde cumulé sur {settings.bp_years} ans
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BPCashFlowChart height={450} />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
        
        <TabsContent value="table">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Détail mensuel</CardTitle>
                <CardDescription>
                  Tableau des flux de trésorerie mois par mois
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BPCashFlowTable />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Paramètres de trésorerie inline */}
      <Card>
        <CardHeader>
          <CardTitle>Paramètres de trésorerie</CardTitle>
          <CardDescription>
            Ces paramètres impactent le calcul des encaissements et décaissements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground">Trésorerie initiale</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(settings.initial_cash)}</p>
              <p className="text-xs text-muted-foreground mt-1">Solde de départ</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground">Délai paiement clients</p>
              <p className="text-2xl font-bold text-foreground">{settings.customer_payment_delay} jours</p>
              <p className="text-xs text-muted-foreground mt-1">Impact sur les encaissements</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground">Délai paiement fournisseurs</p>
              <p className="text-2xl font-bold text-foreground">{settings.supplier_payment_delay} jours</p>
              <p className="text-xs text-muted-foreground mt-1">Impact sur les décaissements</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <SectionNotes 
        section="cash_flow" 
        title="Notes sur la trésorerie"
        placeholder="Documentez vos hypothèses de délais de paiement, saisonnalité des encaissements, besoins de financement..."
      />

      {/* Dialog paramètres */}
      <BPSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
