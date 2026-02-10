import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization } from '@/hooks/useOrganization';
import { useSubscription, PLANS } from '@/hooks/useSubscription';
import { Building2, Crown, CreditCard, Edit2, Save, X, Loader2, ExternalLink, Check, Sparkles, Zap, Users, Flame } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export const OrganizationCard = () => {
  const { currentOrganization, loading, updateOrganization, isOwner } = useOrganization();
  const { subscribed, subscription_end, plan, checkoutLoading, createCheckout, openCustomerPortal } = useSubscription();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setName(currentOrganization?.name || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!currentOrganization || !name.trim()) return;
    setSaving(true);
    try {
      await updateOrganization(currentOrganization.id, { name: name.trim() });
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setName('');
  };

  const handleStartSubscription = async () => {
    try {
      await createCheckout(PLANS.pro.priceId);
      toast.success('Redirection vers la page de paiement...');
    } catch {
      toast.error('Erreur lors de la création du checkout');
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openCustomerPortal();
      toast.success('Redirection vers le portail client...');
    } catch {
      toast.error('Erreur lors de l\'ouverture du portail');
    }
  };

  const getStatusBadge = () => {
    if (subscribed) {
      return <Badge variant="default">Actif</Badge>;
    }
    if (currentOrganization?.subscription_status === 'trialing') {
      const trialEnded = currentOrganization.trial_ends_at 
        ? new Date(currentOrganization.trial_ends_at) < new Date()
        : false;
      if (trialEnded) {
        return <Badge variant="destructive">Essai expiré</Badge>;
      }
      return <Badge variant="secondary">Essai gratuit</Badge>;
    }
    return <Badge variant="outline">Inactif</Badge>;
  };

  const getTrialDaysRemaining = () => {
    if (!currentOrganization?.trial_ends_at) return null;
    const days = differenceInDays(new Date(currentOrganization.trial_ends_at), new Date());
    return days > 0 ? days : 0;
  };

  const isInTrial = currentOrganization?.subscription_status === 'trialing' && 
    currentOrganization?.trial_ends_at && 
    new Date(currentOrganization.trial_ends_at) > new Date();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!currentOrganization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organisation
          </CardTitle>
          <CardDescription>Aucune organisation trouvée</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const trialDaysRemaining = getTrialDaysRemaining();
  const planLabel = plan === 'lifetime' ? 'LIFETIME' : 'PRO';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Organisation</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{planLabel}</Badge>
            {getStatusBadge()}
          </div>
        </div>
        <CardDescription>
          Gérez les paramètres de votre organisation et votre licence
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Organization Name */}
        <div className="space-y-2">
          <Label htmlFor="org-name">Nom de l'organisation</Label>
          {isEditing ? (
            <div className="flex gap-2">
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de l'organisation"
              />
              <Button size="icon" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">{currentOrganization.name}</span>
              {isOwner && (
                <Button size="sm" variant="ghost" onClick={handleEdit}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Modifier
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Trial Status */}
        {isInTrial && trialDaysRemaining !== null && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-primary">
                  {trialDaysRemaining} jour{trialDaysRemaining > 1 ? 's' : ''} restant{trialDaysRemaining > 1 ? 's' : ''} dans votre essai gratuit
                </p>
                <p className="text-sm text-muted-foreground">
                  Votre essai se termine le {format(new Date(currentOrganization.trial_ends_at!), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Social Proof */}
        {!subscribed && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-primary" />
            <span><strong className="text-foreground">127 dirigeants</strong> utilisent Qashflow pour piloter leur trésorerie</span>
          </div>
        )}

        {/* Plan Card */}
        <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">Licence Lifetime</h3>
                <p className="text-muted-foreground text-sm">Accès complet à toutes les fonctionnalités</p>
              </div>
              <div className="text-right">
                {!subscribed && (
                  <div className="text-sm text-muted-foreground line-through">{PLANS.pro.originalPrice}€</div>
                )}
                <div className="text-3xl font-bold text-primary">{PLANS.pro.lifetimePrice}€</div>
                <div className="text-sm text-muted-foreground">paiement unique</div>
              </div>
            </div>
            
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-5">
              {PLANS.pro.features.slice(0, 6).map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {!subscribed ? (
              <div className="space-y-3">
                <Button 
                  className="w-full h-12 text-base font-semibold gap-2" 
                  onClick={handleStartSubscription}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Zap className="h-5 w-5" />
                  )}
                  {isInTrial ? 'Acheter la licence' : 'Acheter la licence'}
                </Button>
                
                {/* Scarcity */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Flame className="h-3.5 w-3.5 text-destructive" />
                  <span>Offre -{PLANS.pro.discount}% — <strong className="text-foreground">plus que 12 places</strong> à ce tarif</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {plan === 'lifetime' && (
                  <p className="text-sm text-muted-foreground text-center">
                    Licence à vie — Accès permanent
                  </p>
                )}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleManageSubscription}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Voir mes factures
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Organization Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Crown className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm text-muted-foreground">Propriétaire</p>
              <p className="font-medium">Vous</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Building2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Sociétés actives</p>
              <p className="font-medium">Illimitées</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
