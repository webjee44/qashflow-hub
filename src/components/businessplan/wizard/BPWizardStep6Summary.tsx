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
  AlertTriangle
} from 'lucide-react';
import { BusinessPlan } from '@/hooks/useBusinessPlans';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BPWizardStep6SummaryProps {
  businessPlan: BusinessPlan | null;
  onFinalize: () => void;
  isLoading: boolean;
}

export function BPWizardStep6Summary({ businessPlan, onFinalize, isLoading }: BPWizardStep6SummaryProps) {
  if (!businessPlan) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Veuillez d'abord créer le business plan dans l'onglet Paramètres.</p>
      </div>
    );
  }

  const isComplete = true; // TODO: Check if all required data is filled

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
                <p className="text-sm text-green-600">Toutes les sections ont été complétées.</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <div>
                <p className="font-medium text-amber-700">Certaines sections sont incomplètes</p>
                <p className="text-sm text-amber-600">Complétez toutes les sections avant de finaliser.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
              Indicateurs clés
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                CA prévisionnel (An 1)
              </span>
              <span className="font-medium">- €</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Charges totales (An 1)
              </span>
              <span className="font-medium">- €</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-500" />
                Résultat net (An 1)
              </span>
              <span className="font-medium">- €</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Seuil de rentabilité</span>
              <span className="font-medium">- mois</span>
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
            {[
              { label: 'Paramètres configurés', done: true },
              { label: 'Revenus définis', done: false },
              { label: 'Charges renseignées', done: false },
              { label: 'Investissements planifiés', done: false },
              { label: 'Financement structuré', done: false },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3">
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
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end">
        <Button variant="outline" className="gap-2">
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
