import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization } from '@/hooks/useOrganization';
import { Building2, Crown, Calendar, Users, CreditCard, Edit2, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const OrganizationCard = () => {
  const { currentOrganization, loading, updateOrganization, isOwner } = useOrganization();
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

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'enterprise': return 'default';
      case 'pro': return 'default';
      case 'starter': return 'secondary';
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
            <Badge variant={getPlanBadgeVariant(currentOrganization.plan)}>
              {currentOrganization.plan.toUpperCase()}
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
          Gérez les paramètres de votre organisation
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

        {/* Organization Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Crown className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm text-muted-foreground">Propriétaire</p>
              <p className="font-medium">Vous</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Membres max</p>
              <p className="font-medium">{currentOrganization.max_members}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Building2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Sociétés max</p>
              <p className="font-medium">{currentOrganization.max_companies}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <CreditCard className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Transactions/mois</p>
              <p className="font-medium">{currentOrganization.max_transactions_per_month}</p>
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

        {/* Upgrade CTA for free plan */}
        {currentOrganization.plan === 'free' && (
          <Button className="w-full" variant="default">
            <CreditCard className="h-4 w-4 mr-2" />
            Passer à un plan supérieur
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
