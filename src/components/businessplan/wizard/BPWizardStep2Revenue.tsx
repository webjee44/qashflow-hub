import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp } from 'lucide-react';

interface BPWizardStep2RevenueProps {
  businessPlanId?: string;
}

export function BPWizardStep2Revenue({ businessPlanId }: BPWizardStep2RevenueProps) {
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
          <h3 className="text-lg font-medium">Hypothèses de revenus</h3>
          <p className="text-sm text-muted-foreground">
            Définissez vos différentes sources de revenus et leurs projections.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un flux
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Flux de revenus
          </CardTitle>
          <CardDescription>
            Gérez vos différentes sources de revenus : ventes, abonnements, prestations...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Aucun flux de revenus configuré.</p>
        </CardContent>
      </Card>
    </div>
  );
}
