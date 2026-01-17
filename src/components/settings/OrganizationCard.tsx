import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization } from '@/hooks/useOrganization';
import { useSubscription, PLANS, PlanKey } from '@/hooks/useSubscription';
import { Building2, Crown, Calendar, CreditCard, Edit2, Save, X, Loader2, ExternalLink, Check } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export const OrganizationCard = () => {
  const { currentOrganization, loading, updateOrganization, isOwner } = useOrganization();
  const { plan, subscribed, subscription_end, checkoutLoading, createCheckout, openCustomerPortal } = useSubscription();
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

  const handleUpgrade = async (planKey: PlanKey) => {
    const planConfig = PLANS[planKey];
    if (!planConfig.priceId) return;
    
    try {
      await createCheckout(planConfig.priceId);
      toast.success('Redirection vers la page de paiement...');
    } catch (error) {
      toast.error('Erreur lors de la création du checkout');
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openCustomerPortal();
      toast.success('Redirection vers le portail client...');
    } catch (error) {
      toast.error('Erreur lors de l\'ouverture du portail');
    }
  };

  const getPlanBadgeVariant = (planName: string) => {
    switch (planName) {
      case 'business': return 'default';
      case 'pro': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'trialing': return 'secondary';
      case 'past_due': return 'destructive';
      case 'canceled': return 'outline';
      default: return 'outline';
    }
  };

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Organisation</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getPlanBadgeVariant(plan)}>
              {plan.toUpperCase()}
            </Badge>
            <Badge variant={getStatusBadgeVariant(currentOrganization.subscription_status)}>
              {currentOrganization.subscription_status === 'trialing' ? 'Essai' : 
               currentOrganization.subscription_status === 'active' ? 'Actif' :
               currentOrganization.subscription_status === 'past_due' ? 'Impayé' : 
               currentOrganization.subscription_status}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Gérez les paramètres de votre organisation et votre abonnement
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

        {/* Plans */}
        <div className="space-y-4">
          <Label>Plans disponibles</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, planConfig]) => {
              const isCurrentPlan = plan === key;
              return (
                <div
                  key={key}
                  className={`p-4 rounded-lg border transition-all ${
                    isCurrentPlan 
                      ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{planConfig.name}</h3>
                    {isCurrentPlan && (
                      <Badge variant="default" className="text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        Actuel
                      </Badge>
                    )}
                  </div>
                  <div className="text-2xl font-bold mb-3">
                    {planConfig.price}€
                    <span className="text-sm font-normal text-muted-foreground">/mois</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground mb-4">
                    {planConfig.features.slice(0, 4).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        {feature}
                      </li>
                    ))}
                    {planConfig.features.length > 4 && (
                      <li className="text-xs text-muted-foreground">
                        +{planConfig.features.length - 4} autres fonctionnalités
                      </li>
                    )}
                  </ul>
                  {!isCurrentPlan && planConfig.priceId && (
                    <Button 
                      className="w-full" 
                      variant={key === 'business' ? 'default' : 'outline'}
                      onClick={() => handleUpgrade(key)}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      {plan === 'free' ? 'Choisir' : 'Changer'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Subscription Management */}
        {subscribed && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Gestion de l'abonnement</p>
                {subscription_end && (
                  <p className="text-sm text-muted-foreground">
                    Prochain renouvellement : {format(new Date(subscription_end), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
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
              Gérer mon abonnement
            </Button>
          </div>
        )}

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
              <p className="font-medium">{currentOrganization.max_companies}</p>
            </div>
          </div>
        </div>

        {/* Trial End Date */}
        {currentOrganization.subscription_status === 'trialing' && currentOrganization.trial_ends_at && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Calendar className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Période d'essai
              </p>
              <p className="text-sm text-muted-foreground">
                Expire le {format(new Date(currentOrganization.trial_ends_at), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
