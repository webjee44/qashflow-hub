import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Package, TrendingDown, RotateCw, Calendar } from 'lucide-react';
import { StockTable } from '@/components/businessplan/StockTable';
import { StockDialog } from '@/components/businessplan/StockDialog';
import { useStocks, Stock } from '@/hooks/useStocks';
import { useBPSettings } from '@/hooks/useBPSettings';

export default function Stocks() {
  const { stocks, createStock, getStockVariation, getStockValueAtEnd, getStockRotationRate, getStockDays, isLoading } = useStocks();
  const { settings } = useBPSettings();
  const [dialogOpen, setDialogOpen] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const handleSave = (data: Partial<Stock>) => {
    createStock.mutate(data);
  };

  // Get current year stats (year 1)
  const currentYear = 1;
  const stockValue = getStockValueAtEnd(currentYear);
  const variation = getStockVariation(currentYear);
  const rotationRate = getStockRotationRate(currentYear);
  const stockDays = getStockDays(currentYear);

  const kpis = [
    {
      title: 'Valeur des stocks (Fin Année 1)',
      value: formatCurrency(stockValue),
      icon: Package,
      color: 'text-primary',
    },
    {
      title: 'Variation de stock',
      value: formatCurrency(variation),
      icon: TrendingDown,
      color: variation > 0 ? 'text-destructive' : 'text-success',
      subtitle: variation > 0 ? 'Destockage' : variation < 0 ? 'Stockage' : 'Stable',
    },
    {
      title: 'Rotation des stocks',
      value: rotationRate > 0 ? `${rotationRate.toFixed(1)}x` : '–',
      icon: RotateCw,
      color: 'text-secondary',
    },
    {
      title: 'Jours de stock',
      value: stockDays > 0 ? `${Math.round(stockDays)} jours` : '–',
      icon: Calendar,
      color: stockDays < 60 ? 'text-success' : stockDays < 90 ? 'text-warning' : 'text-destructive',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestion des Stocks</h1>
          <p className="text-muted-foreground mt-1">
            Stocks de marchandises et matières premières
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau stock
        </Button>
      </div>

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
                {kpi.subtitle && (
                  <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Explanation card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-4">
            <Package className="h-6 w-6 text-muted-foreground shrink-0 mt-1" />
            <div className="space-y-1">
              <p className="font-medium">Marge commerciale réelle</p>
              <p className="text-sm text-muted-foreground">
                La variation de stock impacte directement votre marge commerciale. 
                <strong> Marge commerciale = CA - (Achats + Variation de stocks)</strong>. 
                Un destockage (variation positive) augmente les charges, un stockage les diminue.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Stocks par exercice</CardTitle>
          </CardHeader>
          <CardContent>
            <StockTable />
          </CardContent>
        </Card>
      </motion.div>

      <StockDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
      />
    </div>
  );
}
