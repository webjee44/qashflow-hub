import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFundingPlan } from '@/hooks/useFundingPlan';
import { cn } from '@/lib/utils';
import { Wallet, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function FundingPlanTable() {
  const { data, isBalanced, getFundingGap, isLoading } = useFundingPlan();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement du plan de financement...
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

  const balanced = isBalanced();
  const fundingGap = getFundingGap();

  const getRowStyle = (type: string, isNeed?: boolean) => {
    switch (type) {
      case 'header':
        return 'bg-muted/50 font-semibold text-sm';
      case 'subtotal':
        return cn(
          'font-semibold border-t-2',
          isNeed ? 'bg-destructive/10' : 'bg-success/10'
        );
      case 'total':
        return 'bg-primary/10 font-bold text-primary';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Plan de financement
          </CardTitle>
          {balanced ? (
            <Badge variant="default" className="bg-success">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Équilibré
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              Besoin: {formatCurrency(fundingGap)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Libellé</TableHead>
                {data.years.map((year) => (
                  <TableHead key={year} className="text-right min-w-[120px]">
                    {year}
                  </TableHead>
                ))}
                <TableHead className="text-right min-w-[120px] font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row, index) => {
                const total = row.values.reduce((a, b) => a + b, 0);
                const indent = row.indent || 0;

                return (
                  <TableRow 
                    key={index} 
                    className={getRowStyle(row.type, row.isNeed)}
                  >
                    <TableCell 
                      className="font-medium"
                      style={{ paddingLeft: `${16 + indent * 16}px` }}
                    >
                      {row.label}
                    </TableCell>
                    {row.type === 'header' ? (
                      data.years.map((_, i) => (
                        <TableCell key={i} className="text-right">–</TableCell>
                      ))
                    ) : (
                      row.values.map((value, i) => (
                        <TableCell 
                          key={i} 
                          className={cn(
                            "text-right font-mono",
                            value < 0 && "text-destructive"
                          )}
                        >
                          {formatCurrency(value)}
                        </TableCell>
                      ))
                    )}
                    <TableCell 
                      className={cn(
                        "text-right font-mono font-bold",
                        row.type === 'header' ? '' : '',
                        total < 0 && row.type !== 'header' && "text-destructive"
                      )}
                    >
                      {row.type === 'header' ? '–' : formatCurrency(total)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* CAF Explanation */}
        <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Capacité d'Autofinancement (CAF)
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            La CAF représente les ressources générées par l'activité de l'entreprise. 
            Elle se calcule ainsi : <strong>Résultat Net + Dotations aux amortissements</strong>
          </p>
          <div className="grid grid-cols-3 gap-4">
            {data.years.map((year, i) => (
              <div key={year} className="text-center p-2 bg-background rounded-lg">
                <p className="text-xs text-muted-foreground">{year}</p>
                <p className={cn(
                  "text-lg font-bold",
                  data.resources.caf[i] >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(data.resources.caf[i])}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
