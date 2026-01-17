import { motion } from 'framer-motion';
import { Calendar, Trash2, GitCompare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BPSnapshot } from '@/hooks/useBPSnapshots';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SnapshotCardProps {
  snapshot: BPSnapshot;
  onCompare: () => void;
  onDelete: () => void;
}

export function SnapshotCard({ snapshot, onCompare, onDelete }: SnapshotCardProps) {
  const data = snapshot.snapshot_data;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate totals from snapshot data
  const totalRevenue = data.revenue_streams?.reduce((sum: number, s: any) => 
    sum + (Number(s.monthly_price) || 0) * 12, 0) || 0;
  const totalExpenses = data.fixed_expenses?.reduce((sum: number, e: any) => 
    sum + (Number(e.monthly_amount) || 0) * 12, 0) || 0;
  const totalPersonnel = data.personnel?.reduce((sum: number, p: any) => 
    sum + (Number(p.gross_salary) || 0) * 12, 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="relative group">
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCompare}>
            <GitCompare className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{snapshot.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {format(new Date(snapshot.created_at), 'PPP', { locale: fr })}
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {snapshot.description && (
            <p className="text-sm text-muted-foreground">{snapshot.description}</p>
          )}
          
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">Revenus</p>
              <p className="font-semibold text-success">{data.revenue_streams?.length || 0}</p>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">Charges</p>
              <p className="font-semibold">{data.fixed_expenses?.length || 0}</p>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <p className="text-muted-foreground">Personnel</p>
              <p className="font-semibold">{data.personnel?.length || 0}</p>
            </div>
          </div>

          <div className="pt-2 border-t text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">CA annuel</span>
              <span className="font-medium text-success">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
