import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ExternalLink, Building2, Loader2 } from 'lucide-react';
import { useOrganization } from '@/hooks/useOrganization';
import { useSubscription, PLANS } from '@/hooks/useSubscription';
import { toast } from 'sonner';

export function BillingCard() {
  const { currentOrganization, updateOrganization } = useOrganization();
  const { subscribed, plan, subscription_end, is_trialing, trial_end, checkoutLoading, createCheckout, openCustomerPortal, loading } = useSubscription();
  
  const [billingForm, setBillingForm] = useState({
    billing_name: '',
    billing_email: '',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_postal_code: '',
    billing_country: 'FR',
  });
  const [saving, setSaving] = useState(false);

  // Sync form when org changes
  useEffect(() => {
    if (currentOrganization) {
      const org = currentOrganization as any;
      setBillingForm({
        billing_name: org.billing_name || '',
        billing_email: org.billing_email || '',
        billing_address_line1: org.billing_address_line1 || '',
        billing_address_line2: org.billing_address_line2 || '',
        billing_city: org.billing_city || '',
        billing_postal_code: org.billing_postal_code || '',
        billing_country: org.billing_country || 'FR',
      });
    }
  }, [currentOrganization]);

  const handleSaveBilling = async () => {
    if (!currentOrganization) return;
    setSaving(true);
    try {
      await updateOrganization(currentOrganization.id, billingForm as any);
      toast.success('Informations de facturation mises à jour');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (!currentOrganization) return null;

  const planLabel = plan === 'lifetime' ? 'Licence Lifetime' : plan === 'pro' ? 'Plan PRO' : '';

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Abonnement
          </CardTitle>
          <CardDescription>
            Abonnement de l'organisation « {currentOrganization.name} »
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Vérification...
            </div>
          ) : subscribed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="bg-primary">
                  {is_trialing ? 'Essai gratuit' : planLabel}
                </Badge>
                {is_trialing && trial_end && (
                  <span className="text-sm text-muted-foreground">
                    jusqu'au {formatDate(trial_end)}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                onClick={openCustomerPortal}
                disabled={checkoutLoading}
                className="gap-2"
              >
                {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Voir mes factures
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cette organisation n'a pas de licence active.
              </p>
              <Button
                onClick={() => createCheckout(PLANS.pro.priceId)}
                disabled={checkoutLoading}
                className="gap-2"
              >
                {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Acheter la licence — {PLANS.pro.lifetimePrice}€
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Coordonnées de facturation
          </CardTitle>
          <CardDescription>
            Ces informations apparaîtront sur vos factures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Raison sociale</Label>
              <Input
                value={billingForm.billing_name}
                onChange={(e) => setBillingForm(f => ({ ...f, billing_name: e.target.value }))}
                placeholder="Ma Société SAS"
              />
            </div>
            <div className="space-y-2">
              <Label>Email de facturation</Label>
              <Input
                type="email"
                value={billingForm.billing_email}
                onChange={(e) => setBillingForm(f => ({ ...f, billing_email: e.target.value }))}
                placeholder="facturation@masociete.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Adresse ligne 1</Label>
            <Input
              value={billingForm.billing_address_line1}
              onChange={(e) => setBillingForm(f => ({ ...f, billing_address_line1: e.target.value }))}
              placeholder="123 Rue de la Paix"
            />
          </div>
          <div className="space-y-2">
            <Label>Adresse ligne 2</Label>
            <Input
              value={billingForm.billing_address_line2}
              onChange={(e) => setBillingForm(f => ({ ...f, billing_address_line2: e.target.value }))}
              placeholder="Bâtiment A, 2ème étage"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input
                value={billingForm.billing_city}
                onChange={(e) => setBillingForm(f => ({ ...f, billing_city: e.target.value }))}
                placeholder="Paris"
              />
            </div>
            <div className="space-y-2">
              <Label>Code postal</Label>
              <Input
                value={billingForm.billing_postal_code}
                onChange={(e) => setBillingForm(f => ({ ...f, billing_postal_code: e.target.value }))}
                placeholder="75001"
              />
            </div>
            <div className="space-y-2">
              <Label>Pays</Label>
              <Input
                value={billingForm.billing_country}
                onChange={(e) => setBillingForm(f => ({ ...f, billing_country: e.target.value }))}
                placeholder="FR"
              />
            </div>
          </div>
          <Button onClick={handleSaveBilling} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
