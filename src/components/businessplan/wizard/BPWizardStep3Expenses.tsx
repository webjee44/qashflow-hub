import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Receipt, Users, TrendingDown } from 'lucide-react';
import { useState } from 'react';

interface BPWizardStep3ExpensesProps {
  businessPlanId?: string;
}

export function BPWizardStep3Expenses({ businessPlanId }: BPWizardStep3ExpensesProps) {
  const [activeTab, setActiveTab] = useState('fixed');

  if (!businessPlanId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Veuillez d'abord créer le business plan dans l'onglet Paramètres.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Charges prévisionnelles</h3>
        <p className="text-sm text-muted-foreground">
          Définissez vos charges fixes, variables et vos coûts de personnel.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="fixed" className="gap-2">
            <Receipt className="h-4 w-4" />
            Charges fixes
          </TabsTrigger>
          <TabsTrigger value="variable" className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Charges variables
          </TabsTrigger>
          <TabsTrigger value="personnel" className="gap-2">
            <Users className="h-4 w-4" />
            Personnel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter une charge fixe
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charges fixes</CardTitle>
              <CardDescription>Loyers, assurances, abonnements...</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Aucune charge fixe configurée.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variable" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter une charge variable
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charges variables</CardTitle>
              <CardDescription>Charges liées au chiffre d'affaires.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Aucune charge variable configurée.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personnel" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un poste
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personnel</CardTitle>
              <CardDescription>Salariés et charges sociales.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Aucun poste configuré.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
