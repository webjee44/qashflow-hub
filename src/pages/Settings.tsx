import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { CompanyList } from '@/components/settings/CompanyList';
import { OrganizationCard } from '@/components/settings/OrganizationCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Building2, User, Play, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';

const VALID_TABS = ['organization', 'companies', 'profile'] as const;
type TabValue = typeof VALID_TABS[number];

export default function Settings() {
  const { user } = useAuth();
  const { isCompleted, bpEnabled, toggleBP } = useOnboarding();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get tab from URL hash
  const getTabFromHash = (): TabValue => {
    const hash = location.hash.replace('#', '');
    return VALID_TABS.includes(hash as TabValue) ? (hash as TabValue) : 'organization';
  };
  
  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash);

  // Sync tab with URL hash
  useEffect(() => {
    setActiveTab(getTabFromHash());
  }, [location.hash]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
    navigate(`/parametres#${value}`, { replace: true });
  };

  const handleStartTour = () => {
    localStorage.setItem('show-onboarding-tour', 'true');
    navigate('/previsions');
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
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="w-4 h-4" />
              Organisation
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" />
              Sociétés
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Profil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organization">
            <OrganizationCard />
          </TabsContent>

          <TabsContent value="companies">
            <CompanyList />
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

              {/* Module Business Plan */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Module Business Plan
                  </CardTitle>
                  <CardDescription>
                    Activez le module Business Plan pour créer des prévisionnels financiers complets.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bp-toggle" className="text-sm">
                      Activer le module Business Plan
                    </Label>
                    <Switch
                      id="bp-toggle"
                      checked={bpEnabled}
                      onCheckedChange={toggleBP}
                    />
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
