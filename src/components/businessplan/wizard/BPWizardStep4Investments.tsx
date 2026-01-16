import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Building2 } from 'lucide-react';

interface BPWizardStep4InvestmentsProps {
  businessPlanId?: string;
}

export function BPWizardStep4Investments({ businessPlanId }: BPWizardStep4InvestmentsProps) {
  if (!businessPlanId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Veuillez d'abord créer le business plan dans l'onglet Paramètres.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Investissements</h3>
          <p className="text-sm text-muted-foreground">
            Définissez vos immobilisations et leur plan d'amortissement.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un investissement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Immobilisations
          </CardTitle>
          <CardDescription>Matériel, véhicules, logiciels, aménagements...</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Aucun investissement configuré.</p>
        </CardContent>
      </Card>
    </div>
  );
}
