import { motion } from 'framer-motion';
import { Download, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfitLossTable } from '@/components/businessplan/ProfitLossTable';
import { useProfitLoss } from '@/hooks/useProfitLoss';
import { useBPSettings } from '@/hooks/useBPSettings';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProfitLoss() {
  const { data } = useProfitLoss();
  const { settings } = useBPSettings();

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Compte de Résultat</h1>
          <p className="text-muted-foreground mt-1">
            P&L prévisionnel sur {settings.bp_years} ans • {fiscalYearLabel()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/settings">
            <Button variant="ghost" size="icon" title="Configurer les dates">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">CA Total ({settings.bp_years} ans)</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(data.grandTotal.revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Marge Brute</p>
            <p className="text-2xl font-bold text-success">{data.grandTotal.grossMarginPercent.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Marge EBE</p>
            <p className={`text-2xl font-bold ${data.grandTotal.ebitdaMarginPercent >= 0 ? 'text-success' : 'text-destructive'}`}>
              {data.grandTotal.ebitdaMarginPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Résultat Net Total</p>
            <p className={`text-2xl font-bold ${data.grandTotal.netResult >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(data.grandTotal.netResult)}
            </p>
          </CardContent>
        </Card>
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
    </div>
  );
}
