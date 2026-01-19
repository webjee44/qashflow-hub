import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  ReferenceArea,
  Legend
} from 'recharts';
import { useBPCashFlow } from '@/hooks/useBPCashFlow';
import { Loader2 } from 'lucide-react';

interface BPCashFlowChartProps {
  showAllMonths?: boolean;
  height?: number;
}

export function BPCashFlowChart({ showAllMonths = true, height = 400 }: BPCashFlowChartProps) {
  const { data, isLoading } = useBPCashFlow();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Préparer les données du graphique
  const chartData = data.monthlyData.map((monthData, i) => ({
    month: format(monthData.month, 'MMM yy', { locale: fr }),
    fullMonth: format(monthData.month, 'MMMM yyyy', { locale: fr }),
    inflows: monthData.inflows.total,
    outflows: -monthData.outflows.total, // Négatif pour affichage
    netFlow: monthData.netFlow,
    balance: monthData.balance,
    isNegative: monthData.balance < 0,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatAxisValue = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  // Calculer les valeurs min/max pour l'axe Y
  const allValues = chartData.flatMap(d => [d.inflows, d.outflows, d.balance]);
  const minY = Math.min(...allValues, 0);
  const maxY = Math.max(...allValues);
  const yDomain = [Math.floor(minY * 1.1), Math.ceil(maxY * 1.1)];

  // Tooltip personnalisé
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{data.fullMonth}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-success">Encaissements:</span>
            <span className="font-medium">{formatCurrency(data.inflows)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-destructive">Décaissements:</span>
            <span className="font-medium">{formatCurrency(Math.abs(data.outflows))}</span>
          </div>
          <div className="border-t border-border pt-1 mt-1">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Flux net:</span>
              <span className={`font-medium ${data.netFlow >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(data.netFlow)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-primary font-medium">Solde:</span>
              <span className={`font-bold ${data.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(data.balance)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="colorInflows" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.8} />
            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="colorOutflows" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
            <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        
        <XAxis 
          dataKey="month" 
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          interval={Math.max(0, Math.floor(chartData.length / 12) - 1)}
        />
        
        <YAxis 
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          tickFormatter={formatAxisValue}
          domain={yDomain}
        />
        
        <Tooltip content={<CustomTooltip />} />
        
        <Legend 
          wrapperStyle={{ paddingTop: 10 }}
          formatter={(value) => {
            const labels: Record<string, string> = {
              inflows: 'Encaissements',
              outflows: 'Décaissements',
              balance: 'Solde cumulé',
            };
            return <span className="text-sm">{labels[value] || value}</span>;
          }}
        />
        
        {/* Zone de danger (solde négatif) */}
        {minY < 0 && (
          <ReferenceArea 
            y1={minY} 
            y2={0} 
            fill="hsl(var(--destructive))" 
            fillOpacity={0.1}
          />
        )}
        
        {/* Ligne zéro */}
        <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={2} />
        
        {/* Barres encaissements */}
        <Bar 
          dataKey="inflows" 
          fill="url(#colorInflows)"
          radius={[2, 2, 0, 0]}
          maxBarSize={20}
        />
        
        {/* Barres décaissements (négatives) */}
        <Bar 
          dataKey="outflows" 
          fill="url(#colorOutflows)"
          radius={[0, 0, 2, 2]}
          maxBarSize={20}
        />
        
        {/* Courbe du solde cumulé */}
        <Line
          type="monotone"
          dataKey="balance"
          stroke="hsl(var(--primary))"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
