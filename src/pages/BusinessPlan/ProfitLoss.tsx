import { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProfitLossTable, RatiosCard, SectionNotes } from '@/features/business-plan/components';
import { BreakEvenChart } from '@/features/business-plan/charts';
import { BPExportDialog } from '@/features/business-plan/dialogs';
import { useProfitLoss } from '@/hooks/useProfitLoss';
import { useBPSettings } from '@/hooks/useBPSettings';
import { PageHeader } from '@/components/layout/PageHeader';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProfitLoss() {
  const { data } = useProfitLoss();
  const { settings } = useBPSettings();
  const [selectedYear, setSelectedYear] = useState(0);

  const formatCurrency = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  // Format fiscal year period
  const fiscalYearLabel = () => {
    if (data.years.length === 0) return '';
    const start = data.years[0].start;
    const end = data.years[data.years.length - 1].end;
    return `${format(start, 'MMM yyyy', { locale: fr })} - ${format(end, 'MMM yyyy', { locale: fr })}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compte de Résultat"
        subtitle={`P&L prévisionnel sur ${settings.bp_years} ans • ${fiscalYearLabel()}`}
        actions={
          <div className="flex gap-2">
            <Link to="/settings">
              <Button variant="ghost" size="icon" title="Configurer les dates">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <BPExportDialog />
          </div>
        }
      />

      {/* Summary cards */}
      <div data-tour-bp="pnl-summary" className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground">CA Total</p>
              <span className="text-xs text-muted-foreground/70">({settings.bp_years} ans)</span>
            </div>
            <p className="text-2xl font-bold text-success">{formatCurrency(data.grandTotal.revenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              An {selectedYear + 1}: {formatCurrency(data.totals.revenue[selectedYear] || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground">Marge Brute</p>
              <span className="text-xs text-muted-foreground/70">(cumul {settings.bp_years} ans)</span>
            </div>
            <p className="text-2xl font-bold text-success">{data.grandTotal.grossMarginPercent.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              An {selectedYear + 1}: {((data.totals.revenue[selectedYear] - (data.totals.cogs?.[selectedYear] || 0)) / (data.totals.revenue[selectedYear] || 1) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground">Marge EBE</p>
              <span className="text-xs text-muted-foreground/70">(cumul {settings.bp_years} ans)</span>
            </div>
            <p className={`text-2xl font-bold ${data.grandTotal.ebitdaMarginPercent >= 0 ? 'text-success' : 'text-destructive'}`}>
              {data.grandTotal.ebitdaMarginPercent.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              An {selectedYear + 1}: {((data.totals.ebitda[selectedYear] || 0) / (data.totals.revenue[selectedYear] || 1) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-1">
              <p className="text-sm text-muted-foreground">Résultat Net</p>
              <span className="text-xs text-muted-foreground/70">(cumul {settings.bp_years} ans)</span>
            </div>
            <p className={`text-2xl font-bold ${data.grandTotal.netResult >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(data.grandTotal.netResult)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              An {selectedYear + 1}: {formatCurrency(data.totals.netResult[selectedYear] || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Year selector for charts */}
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

      {/* Ratios and Break-even */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RatiosCard yearIndex={selectedYear} />
        <BreakEvenChart yearIndex={selectedYear} />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle>P&L Prévisionnel - {settings.bp_years} ans</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfitLossTable />
          </CardContent>
        </Card>
      </motion.div>

      <SectionNotes 
        section="pnl" 
        title="Notes sur le compte de résultat"
        placeholder="Documentez vos hypothèses de marge, saisonnalité, ou événements exceptionnels..."
      />
    </div>
  );
}
