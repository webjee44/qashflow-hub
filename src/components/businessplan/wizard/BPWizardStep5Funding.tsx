import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Wallet, PiggyBank, Landmark } from 'lucide-react';

interface BPWizardStep5FundingProps {
  businessPlanId?: string;
}

export function BPWizardStep5Funding({ businessPlanId }: BPWizardStep5FundingProps) {
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
          <h3 className="text-lg font-medium">Plan de financement</h3>
          <p className="text-sm text-muted-foreground">
            Définissez vos sources de financement.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un financement
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-primary">
              <PiggyBank className="h-4 w-4" />
              Capital
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0 €</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-blue-600">
              <Landmark className="h-4 w-4" />
              Emprunts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0 €</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <Wallet className="h-4 w-4" />
              Subventions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0 €</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Sources de financement
          </CardTitle>
          <CardDescription>Tous vos moyens de financement.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Aucun financement configuré.</p>
        </CardContent>
      </Card>
    </div>
  );
}
