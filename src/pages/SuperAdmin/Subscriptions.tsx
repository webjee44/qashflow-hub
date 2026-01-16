import { CreditCard } from 'lucide-react';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SuperAdminSubscriptions() {
  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Abonnements</h1>
          <p className="text-muted-foreground">
            Gérez les abonnements et les plans de la plateforme
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Intégration Stripe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Bientôt disponible</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                L'intégration Stripe vous permettra de gérer les abonnements, 
                créer des plans tarifaires et suivre les revenus directement depuis ce dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
