import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileCheck, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Target, 
  Calendar,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users
} from 'lucide-react';
import { BusinessPlan } from '@/hooks/useBusinessPlans';
import { useBPRevenueStreams } from '@/hooks/useBPRevenueStreams';
import { useBPFixedExpenses } from '@/hooks/useBPFixedExpenses';
import { useBPPersonnel } from '@/hooks/useBPPersonnel';
import { useBPInvestments } from '@/hooks/useBPInvestments';
import { useBPFinancings } from '@/hooks/useBPFinancings';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BPWizardStep7SummaryProps {
  businessPlan: BusinessPlan | null;
  onFinalize: () => void;
  isLoading: boolean;
}

export function BPWizardStep7Summary({ businessPlan, onFinalize, isLoading }: BPWizardStep7SummaryProps) {
  const { streams, totalMonthlyRevenue } = useBPRevenueStreams();
  const { expenses, totalMonthlyExpenses } = useBPFixedExpenses();
  const { personnel, totalMonthlyCost: personnelCost } = useBPPersonnel();
  const { investments, totalInvestments } = useBPInvestments();
  const { financings, totalFunding } = useBPFinancings();

  if (!businessPlan) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Veuillez d'abord créer le business plan dans l'onglet Paramètres.</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Calculate key metrics
  const yearlyRevenue = totalMonthlyRevenue * 12;
  const yearlyExpenses = (totalMonthlyExpenses + personnelCost) * 12;
  const yearlyResult = yearlyRevenue - yearlyExpenses;
  const fundingGap = totalInvestments - totalFunding;

  // Check completion status
  const hasRevenue = streams.length > 0;
  const hasExpenses = expenses.length > 0 || personnel.length > 0;
  const hasInvestments = investments.length > 0;
  const hasFunding = financings.length > 0;
  const isComplete = hasRevenue && hasExpenses;

  const checklist = [
    { label: 'Paramètres configurés', done: !!businessPlan.name },
    { label: 'Revenus définis', done: hasRevenue, count: streams.length },
    { label: 'Charges renseignées', done: hasExpenses, count: expenses.length + personnel.length },
    { label: 'Investissements planifiés', done: hasInvestments, count: investments.length },
    { label: 'Financement structuré', done: hasFunding, count: financings.length },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h3 className="text-lg font-medium">Synthèse du Business Plan</h3>
        <p className="text-sm text-muted-foreground">
          Vérifiez les informations et finalisez votre business plan.
        </p>
      </div>

      {/* Status Banner */}
      <Card className={isComplete ? 'border-green-500/20 bg-green-500/5' : 'border-amber-500/20 bg-amber-500/5'}>
        <CardContent className="flex items-center gap-4 py-4">
          {isComplete ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Votre Business Plan est prêt</p>
                <p className="text-sm text-green-600">Toutes les sections obligatoires ont été complétées.</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <div>
                <p className="font-medium text-amber-700">Certaines sections sont incomplètes</p>
                <p className="text-sm text-amber-600">Ajoutez au moins des revenus et des charges.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">CA Annuel (An 1)</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(yearlyRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-xs text-muted-foreground">Charges (An 1)</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(yearlyExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={yearlyResult >= 0 ? 'border-primary/20 bg-primary/5' : 'border-red-500/20 bg-red-500/5'}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Wallet className={yearlyResult >= 0 ? 'h-5 w-5 text-primary' : 'h-5 w-5 text-red-600'} />
              <div>
                <p className="text-xs text-muted-foreground">Résultat (An 1)</p>
                <p className={`text-lg font-bold ${yearlyResult >= 0 ? 'text-primary' : 'text-red-700'}`}>
                  {formatCurrency(yearlyResult)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">Investissements</p>
                <p className="text-lg font-bold text-purple-700">{formatCurrency(totalInvestments)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Informations générales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nom</span>
              <span className="font-medium">{businessPlan.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date de démarrage</span>
              <span className="font-medium">
                {businessPlan.bp_start_date 
                  ? format(new Date(businessPlan.bp_start_date), 'MMMM yyyy', { locale: fr })
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Durée</span>
              <span className="font-medium">{businessPlan.bp_years} ans</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Régime fiscal</span>
              <Badge variant="secondary">
                {businessPlan.tax_regime === 'is' ? 'IS' : businessPlan.tax_regime === 'ir' ? 'IR' : 'Micro'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Équilibre financier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Investissements</span>
              <span className="font-medium">{formatCurrency(totalInvestments)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Financement prévu</span>
              <span className="font-medium">{formatCurrency(totalFunding)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-muted-foreground font-medium">
                {fundingGap > 0 ? 'Besoin supplémentaire' : 'Excédent de financement'}
              </span>
              <span className={`font-bold ${fundingGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(Math.abs(fundingGap))}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist de validation</CardTitle>
          <CardDescription>Vérifiez que toutes les sections sont complètes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checklist.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    item.done ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <span className="text-xs">{index + 1}</span>
                    )}
                  </div>
                  <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                    {item.label}
                  </span>
                </div>
                {item.count !== undefined && (
                  <Badge variant="secondary">{item.count} élément{item.count > 1 ? 's' : ''}</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end">
        <Button variant="outline" className="gap-2" disabled>
          <Download className="h-4 w-4" />
          Télécharger le brouillon
        </Button>
        <Button 
          onClick={onFinalize} 
          disabled={isLoading || !isComplete}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileCheck className="h-4 w-4" />
          )}
          Finaliser le Business Plan
        </Button>
      </div>
    </div>
  );
}
