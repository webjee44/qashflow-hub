import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BPSnapshot, useBPSnapshots } from '@/hooks/useBPSnapshots';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SnapshotCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: BPSnapshot | null;
}

export function SnapshotCompareDialog({ open, onOpenChange, snapshot }: SnapshotCompareDialogProps) {
  const { compareSnapshots } = useBPSnapshots();

  if (!snapshot) return null;

  const comparison = compareSnapshots(snapshot);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDiff = (v1: number, v2: number) => {
    const diff = v2 - v1;
    const percent = v1 !== 0 ? ((diff / v1) * 100).toFixed(1) : '∞';
    return {
      value: diff,
      percent,
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same',
    };
  };

  const ComparisonRow = ({ label, value1, value2 }: { label: string; value1: number; value2: number }) => {
    const diff = formatDiff(value1, value2);
    
    return (
      <div className="flex items-center justify-between py-3 border-b border-border/50">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium w-24 text-right">{formatCurrency(value1)}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium w-24 text-right">{formatCurrency(value2)}</span>
          <Badge 
            variant={diff.direction === 'up' ? 'default' : diff.direction === 'down' ? 'destructive' : 'secondary'}
            className="w-20 justify-center"
          >
            {diff.direction === 'up' && <TrendingUp className="h-3 w-3 mr-1" />}
            {diff.direction === 'down' && <TrendingDown className="h-3 w-3 mr-1" />}
            {diff.direction === 'same' && <Minus className="h-3 w-3 mr-1" />}
            {diff.percent}%
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Comparaison</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {/* Version headers */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div className="flex-1">
              <Badge variant="outline" className="mb-1">Snapshot</Badge>
              <p className="font-semibold">{comparison.version1.label}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(comparison.version1.date), 'PPP', { locale: fr })}
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground mx-4" />
            <div className="flex-1 text-right">
              <Badge variant="default" className="mb-1">Actuel</Badge>
              <p className="font-semibold">{comparison.version2.label}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(comparison.version2.date), 'PPP', { locale: fr })}
              </p>
            </div>
          </div>

          {/* Comparison rows */}
          <div className="space-y-1">
            <ComparisonRow 
              label="Revenus mensuels" 
              value1={comparison.version1.totalRevenue} 
              value2={comparison.version2.totalRevenue} 
            />
            <ComparisonRow 
              label="Charges fixes mensuelles" 
              value1={comparison.version1.totalFixedExpenses} 
              value2={comparison.version2.totalFixedExpenses} 
            />
            <ComparisonRow 
              label="Masse salariale mensuelle" 
              value1={comparison.version1.totalPersonnel} 
              value2={comparison.version2.totalPersonnel} 
            />
            <ComparisonRow 
              label="Investissements totaux" 
              value1={comparison.version1.totalInvestments} 
              value2={comparison.version2.totalInvestments} 
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
