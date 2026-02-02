import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Scale, TrendingUp, PiggyBank, Wallet } from 'lucide-react';
import { BalanceSheetTable, RatiosCard, SectionNotes } from '@/features/business-plan/components';
import { BFRChart } from '@/features/business-plan/charts';
import { BPExportDialog } from '@/features/business-plan/dialogs';
import { useBalanceSheet } from '@/hooks/useBalanceSheet';
import { useBPSettings } from '@/hooks/useBPSettings';
import { PageHeader } from '@/components/layout/PageHeader';

export default function BalanceSheet() {
  const { data, getDebtToEquityRatio, getSolvencyRatio, isLoading } = useBalanceSheet();
  const { settings } = useBPSettings();
  const [selectedYear, setSelectedYear] = useState(0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  // Get last year index
  const lastYearIndex = data.years.length - 1;

  const kpis = [
    {
      title: 'Total Actif',
      value: formatCurrency(data.totals.totalAssets[lastYearIndex] || 0),
      icon: Scale,
      color: 'text-primary',
    },
    {
      title: 'Capitaux Propres',
      value: formatCurrency(data.totals.equity[lastYearIndex] || 0),
      icon: PiggyBank,
      color: data.totals.equity[lastYearIndex] >= 0 ? 'text-success' : 'text-destructive',
    },
    {
      title: 'Ratio d\'endettement',
      value: formatPercent(getDebtToEquityRatio(lastYearIndex)),
      icon: TrendingUp,
      color: getDebtToEquityRatio(lastYearIndex) < 1 ? 'text-success' : 'text-warning',
    },
    {
      title: 'Ratio de solvabilité',
      value: formatPercent(getSolvencyRatio(lastYearIndex)),
      icon: Wallet,
      color: getSolvencyRatio(lastYearIndex) > 0.3 ? 'text-success' : 'text-warning',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bilan Prévisionnel"
        subtitle={`Structure financière sur ${settings.bp_years} ans`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Paramètres
            </Button>
            <BPExportDialog />
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">Analyser l'année :</span>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {data.years.map((_, index) => (
              <SelectItem key={index} value={index.toString()}>
                Année {index + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ratios Card */}
      <RatiosCard yearIndex={selectedYear} />

      {/* BFR Chart */}
      <BFRChart />

      {/* Balance Sheet Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Bilan détaillé</CardTitle>
          </CardHeader>
          <CardContent>
            <BalanceSheetTable />
          </CardContent>
        </Card>
      </motion.div>

      <SectionNotes 
        section="balance_sheet" 
        title="Notes sur le bilan"
        placeholder="Documentez vos hypothèses de structure financière, politique d'investissement..."
      />
    </div>
  );
}
