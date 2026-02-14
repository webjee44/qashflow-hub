import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Settings, ChevronDown, TrendingUp, RefreshCw } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
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
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProfitLoss() {
  const { data } = useProfitLoss();
  const { settings } = useBPSettings();
  const [selectedYear, setSelectedYear] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['bp_revenue_streams'] });
    await queryClient.invalidateQueries({ queryKey: ['bp_fixed_expenses'] });
    await queryClient.invalidateQueries({ queryKey: ['bp_variable_expenses'] });
    await queryClient.invalidateQueries({ queryKey: ['bp_personnel'] });
    await queryClient.invalidateQueries({ queryKey: ['bp_directors'] });
    await queryClient.invalidateQueries({ queryKey: ['bp_investments'] });
    await queryClient.invalidateQueries({ queryKey: ['bp_financings'] });
    await queryClient.invalidateQueries({ queryKey: ['bp_revenue_forecasts_by_streams'] });
    await queryClient.invalidateQueries({ queryKey: ['bp_stocks'] });
    await queryClient.invalidateQueries({ queryKey: ['bp_settings'] });
    setTimeout(() => setIsRefreshing(false), 600);
  }, [queryClient]);

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
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Actualiser
            </Button>
            <Link to="/settings">
              <Button variant="ghost" size="icon" title="Configurer les dates">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <BPExportDialog />
          </div>
        }
      />

      {/* Summary cards - Dynamic based on selected year */}
      <div data-tour-bp="pnl-summary" className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Chiffre d'affaires</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(data.totals.revenue[selectedYear] || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Année {selectedYear + 1}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Marge Brute</p>
            <p className="text-2xl font-bold text-success">
              {((data.totals.revenue[selectedYear] - (data.totals.cogs?.[selectedYear] || 0)) / (data.totals.revenue[selectedYear] || 1) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Année {selectedYear + 1}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Marge EBE</p>
            <p className={`text-2xl font-bold ${(data.totals.ebitda[selectedYear] || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {((data.totals.ebitda[selectedYear] || 0) / (data.totals.revenue[selectedYear] || 1) * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Année {selectedYear + 1}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Résultat Net</p>
            <p className={`text-2xl font-bold ${(data.totals.netResult[selectedYear] || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(data.totals.netResult[selectedYear] || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Année {selectedYear + 1}</p>
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

      {/* Collapsible analysis section */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-md">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-semibold">Ratios & Seuil de rentabilité</span>
                <p className="text-sm text-muted-foreground group-data-[state=closed]:hidden">Année {selectedYear + 1} • Cliquez pour replier</p>
                <p className="text-sm text-muted-foreground group-data-[state=open]:hidden">Année {selectedYear + 1} • Cliquez pour afficher</p>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-primary transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <RatiosCard yearIndex={selectedYear} />
            <BreakEvenChart yearIndex={selectedYear} />
          </div>
        </CollapsibleContent>
      </Collapsible>

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
