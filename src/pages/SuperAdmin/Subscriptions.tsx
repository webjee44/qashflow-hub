import { useState } from 'react';
import { CreditCard, Package, Users, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PLANS } from '@/hooks/useSubscription';

export default function SuperAdminSubscriptions() {
  const [refreshing, setRefreshing] = useState(false);

  // Fetch organizations with subscription data
  const { data: organizations, isLoading, refetch } = useQuery({
    queryKey: ['superadmin-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_superadmin_org_stats');
      if (error) throw error;
      return data;
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Get Pro plan price from PLANS
  const proPlanPrice = PLANS.pro?.price || 49;

  // Calculate stats
  const stats = {
    totalOrgs: organizations?.length || 0,
    paidOrgs: organizations?.filter(o => o.plan !== 'free').length || 0,
    activeSubscriptions: organizations?.filter(o => o.subscription_status === 'active').length || 0,
    mrr: organizations?.reduce((acc, org) => {
      if (org.plan === 'pro') return acc + proPlanPrice;
      return acc;
    }, 0) || 0,
  };

  const planColors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    trialing: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    past_due: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Abonnements</h1>
            <p className="text-muted-foreground">
              Gérez les abonnements et suivez les revenus
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button asChild>
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Stripe Dashboard
              </a>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Organisations</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrgs}</div>
              <p className="text-xs text-muted-foreground">Total inscrites</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Payantes</CardTitle>
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.paidOrgs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalOrgs > 0 
                  ? `${((stats.paidOrgs / stats.totalOrgs) * 100).toFixed(0)}% de conversion`
                  : 'Aucune organisation'
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Actives</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
              <p className="text-xs text-muted-foreground">Abonnements actifs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.mrr}€</div>
              <p className="text-xs text-muted-foreground">Revenus mensuels</p>
            </CardContent>
          </Card>
        </div>

        {/* Plans Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Plans tarifaires
            </CardTitle>
            <CardDescription>Configuration des plans Stripe</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(PLANS).map(([key, plan]) => (
                <div
                  key={key}
                  className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    <Badge className={planColors[key]}>{key.toUpperCase()}</Badge>
                  </div>
                  <div className="text-3xl font-bold mb-4">
                    {plan.price}€
                    <span className="text-sm font-normal text-muted-foreground">/mois</span>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Toutes les organisations
            </CardTitle>
            <CardDescription>Liste complète des organisations et leurs abonnements</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : organizations && organizations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Membres</TableHead>
                    <TableHead className="text-right">Sociétés</TableHead>
                    <TableHead>Créée le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.organization_id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>
                        <Badge className={planColors[org.plan] || planColors.free}>
                          {org.plan.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[org.subscription_status] || statusColors.canceled}>
                          {org.subscription_status === 'trialing' ? 'Essai' : 
                           org.subscription_status === 'active' ? 'Actif' :
                           org.subscription_status === 'past_due' ? 'Impayé' : 
                           org.subscription_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{org.member_count}</TableCell>
                      <TableCell className="text-right">{org.company_count}</TableCell>
                      <TableCell>
                        {format(new Date(org.created_at), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Aucune organisation trouvée
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
