import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useBPRatios } from '@/hooks/useBPRatios';
import { cn } from '@/lib/utils';

interface RatiosCardProps {
  yearIndex?: number;
  compact?: boolean;
}

export function RatiosCard({ yearIndex = 0, compact = false }: RatiosCardProps) {
  const { ratios, getRatioStatus, isLoading } = useBPRatios();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement des ratios...
        </CardContent>
      </Card>
    );
  }

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatRatio = (value: number) => value.toFixed(2);

  const ratioItems = [
    {
      label: 'Marge brute',
      value: ratios.grossMargin[yearIndex],
      format: formatPercent,
      description: 'Rentabilité après coûts variables',
      status: ratios.grossMargin[yearIndex] >= 40 ? 'good' : ratios.grossMargin[yearIndex] >= 20 ? 'warning' : 'bad',
    },
    {
      label: 'Marge nette',
      value: ratios.netMargin[yearIndex],
      format: formatPercent,
      description: 'Rentabilité après toutes charges',
      status: getRatioStatus('netMargin', ratios.netMargin[yearIndex]),
    },
    {
      label: 'ROE',
      value: ratios.roe[yearIndex],
      format: formatPercent,
      description: 'Retour sur capitaux propres',
      status: ratios.roe[yearIndex] >= 15 ? 'good' : ratios.roe[yearIndex] >= 8 ? 'warning' : 'bad',
    },
    {
      label: 'Ratio de liquidité',
      value: ratios.currentRatio[yearIndex],
      format: formatRatio,
      description: 'Actifs courants / Passifs courants (idéal > 1.5)',
      status: getRatioStatus('currentRatio', ratios.currentRatio[yearIndex]),
    },
    {
      label: 'Endettement',
      value: ratios.debtToEquity[yearIndex],
      format: formatRatio,
      description: 'Dettes / Capitaux propres (idéal < 1)',
      status: getRatioStatus('debtToEquity', ratios.debtToEquity[yearIndex]),
    },
    {
      label: 'Couverture des intérêts',
      value: ratios.interestCoverage[yearIndex],
      format: (v) => v > 100 ? '∞' : formatRatio(v),
      description: 'EBITDA / Charges financières (idéal > 3)',
      status: getRatioStatus('interestCoverage', ratios.interestCoverage[yearIndex]),
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'bad': return <TrendingDown className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-success';
      case 'warning': return 'text-amber-500';
      case 'bad': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  if (compact) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {ratioItems.slice(0, 6).map((item) => (
          <TooltipProvider key={item.label}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors cursor-help">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    {getStatusIcon(item.status)}
                  </div>
                  <p className={cn("text-lg font-bold", getStatusColor(item.status))}>
                    {item.format(item.value)}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{item.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Ratios financiers - Année {yearIndex + 1}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {ratioItems.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.label}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-[200px]">{item.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("font-bold", getStatusColor(item.status))}>
                    {item.format(item.value)}
                  </span>
                  {getStatusIcon(item.status)}
                </div>
              </div>
              <Progress 
                value={Math.min(100, Math.abs(item.value))} 
                className={cn(
                  "h-2",
                  item.status === 'good' && "[&>div]:bg-success",
                  item.status === 'warning' && "[&>div]:bg-amber-500",
                  item.status === 'bad' && "[&>div]:bg-destructive"
                )}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
