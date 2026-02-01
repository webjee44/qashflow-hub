import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InvoiceStatsProps {
  pendingReceivables: number;
  pendingPayables: number;
  overdueReceivables: number;
  overduePayables: number;
  netPosition: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function InvoiceStats({
  pendingReceivables,
  pendingPayables,
  overdueReceivables,
  overduePayables,
  netPosition,
}: InvoiceStatsProps) {
  const stats = [
    {
      label: 'Créances clients',
      value: pendingReceivables,
      icon: ArrowDownLeft,
      color: 'text-success',
      bgColor: 'bg-success/10',
      subtitle: overdueReceivables > 0 ? `dont ${formatCurrency(overdueReceivables)} échues` : null,
    },
    {
      label: 'Dettes fournisseurs',
      value: pendingPayables,
      icon: ArrowUpRight,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      subtitle: overduePayables > 0 ? `dont ${formatCurrency(overduePayables)} échues` : null,
    },
    {
      label: 'Position nette',
      value: netPosition,
      icon: TrendingUp,
      color: netPosition >= 0 ? 'text-success' : 'text-destructive',
      bgColor: netPosition >= 0 ? 'bg-success/10' : 'bg-destructive/10',
      subtitle: netPosition >= 0 ? 'Créances > Dettes' : 'Dettes > Créances',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <p className={cn("text-2xl font-bold", stat.color)}>
                  {formatCurrency(stat.value)}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {stat.subtitle.includes('échues') && (
                      <AlertTriangle className="h-3 w-3 text-warning" />
                    )}
                    {stat.subtitle}
                  </p>
                )}
              </div>
              <div className={cn("p-3 rounded-xl", stat.bgColor)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
