import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { CompanyList } from '@/components/settings/CompanyList';
import { OrganizationCard } from '@/components/settings/OrganizationCard';
import { BankAccountsCard } from '@/components/settings/BankAccountsCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Building2, User, Landmark } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { logError } from '@/lib/logger';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VALID_TABS = ['organization', 'companies', 'accounts', 'profile'] as const;
type TabValue = typeof VALID_TABS[number];

export default function Settings() {
  const { user } = useAuth();
  const { companies } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Get tab from URL hash or query param
  const getTabFromHash = (): TabValue => {
    // First check query param (Bridge callback uses ?tab=)
    const tabParam = searchParams.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam as TabValue)) {
      return tabParam as TabValue;
    }
    // Then check hash
    const hash = location.hash.replace('#', '');
    return VALID_TABS.includes(hash as TabValue) ? (hash as TabValue) : 'organization';
  };
  
  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash);

  // Handle Bridge callback after bank connection
  const handleBridgeCallback = useCallback(async () => {
    const bridgeCallback = searchParams.get('bridge_callback');
    if (bridgeCallback !== 'success') return;
    
    setIsSyncing(true);
    toast.info('Synchronisation des comptes bancaires...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée, veuillez vous reconnecter');
        return;
      }

      // Refetch to get the latest bridge_user_uuid
      const { data: freshCompanies } = await supabase
        .from('companies')
        .select('id, bridge_user_uuid')
        .not('bridge_user_uuid', 'is', null);
      
      if (!freshCompanies || freshCompanies.length === 0) {
        toast.error('Aucune connexion bancaire trouvée');
        // Still clear the URL params
        navigate('/parametres#accounts', { replace: true });
        return;
      }

      // Sync accounts for freshly connected company
      for (const company of freshCompanies) {
        await supabase.functions.invoke('bridge-sync', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { 
            action: 'sync-accounts',
            bridge_user_uuid: company.bridge_user_uuid,
            company_id: company.id,
          },
        });
      }

      toast.success('Comptes bancaires synchronisés !');
      
      // Clear URL params and navigate to accounts tab with hash
      navigate('/parametres#accounts', { replace: true });
      
      // Force page reload to refresh the accounts list
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      logError('Bridge sync error:', error);
      toast.error('Erreur lors de la synchronisation');
      navigate('/parametres#accounts', { replace: true });
    } finally {
      setIsSyncing(false);
    }
  }, [searchParams, navigate]);

  // Trigger Bridge callback handler
  useEffect(() => {
    const bridgeCallback = searchParams.get('bridge_callback');
    if (bridgeCallback === 'success') {
      handleBridgeCallback();
    }
  }, [searchParams, handleBridgeCallback]);

  // Sync tab with URL hash
  useEffect(() => {
    setActiveTab(getTabFromHash());
  }, [location.hash, searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
    navigate(`/parametres#${value}`, { replace: true });
  };


  return (
    <div className="min-h-screen">
      <PageHeader title="Paramètres" subtitle="Gérez vos sociétés et préférences" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="bg-card border border-border w-full flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Organisation</span>
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Sociétés</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2">
              <Landmark className="w-4 h-4" />
              <span className="hidden sm:inline">Comptes bancaires</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Facturation</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organization">
            <OrganizationCard />
          </TabsContent>

          <TabsContent value="companies">
            <CompanyList />
          </TabsContent>

          <TabsContent value="accounts">
            <BankAccountsCard />
          </TabsContent>

          <TabsContent value="billing">
            <BillingCard />
          </TabsContent>

          <TabsContent value="profile">
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Profil utilisateur</CardTitle>
                  <CardDescription>Informations de votre compte</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-foreground">{user?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">ID utilisateur</label>
                    <p className="text-foreground text-sm font-mono">{user?.id}</p>
                  </div>
                </CardContent>
              </Card>


              {/* Onboarding Tour */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5 text-primary" />
                    Visite guidée
                  </CardTitle>
                  <CardDescription>
                    Relancez la visite guidée pour découvrir toutes les fonctionnalités de l'application.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleStartTour}
                    variant="outline"
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    {isCompleted ? "Relancer la visite guidée" : "Continuer la visite"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
