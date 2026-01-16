import { motion } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { CompanyList } from '@/components/settings/CompanyList';
import { BPSettingsCard } from '@/components/settings/BPSettingsCard';
import { OrganizationCard } from '@/components/settings/OrganizationCard';
import { TrashCard } from '@/components/settings/TrashCard';
import { DataExportsCard } from '@/components/settings/DataExportsCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Building2, User, Shield, TrendingUp, Trash2, HardDrive, Blocks, Play, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';

export default function Settings() {
  const { user } = useAuth();
  const { bpEnabled, enableBP, startTour, isCompleted } = useOnboarding();

  return (
    <div className="min-h-screen">
      <PageHeader title="Paramètres" subtitle="Gérez vos sociétés et préférences" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Tabs defaultValue="organization" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="organization" className="gap-2">
              <Building2 className="w-4 h-4" />
              Organisation
            </TabsTrigger>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" />
              Sociétés
            </TabsTrigger>
            <TabsTrigger value="modules" className="gap-2">
              <Blocks className="w-4 h-4" />
              Modules
            </TabsTrigger>
            <TabsTrigger value="businessplan" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Business Plan
            </TabsTrigger>
            <TabsTrigger value="trash" className="gap-2">
              <Trash2 className="w-4 h-4" />
              Corbeille
            </TabsTrigger>
            <TabsTrigger value="exports" className="gap-2">
              <HardDrive className="w-4 h-4" />
              Sauvegardes
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Sécurité
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organization">
            <OrganizationCard />
          </TabsContent>

          <TabsContent value="companies">
            <CompanyList />
          </TabsContent>

          <TabsContent value="modules">
            <div className="space-y-6">
              {/* Module Business Plan */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Module Business Plan
                  </CardTitle>
                  <CardDescription>
                    Créez des business plans complets avec projections financières, compte de résultat et plan de financement.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="space-y-1">
                      <Label htmlFor="bp-toggle" className="text-base font-medium">
                        Activer le module Business Plan
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {bpEnabled 
                          ? "Le module est actif. Vous pouvez basculer entre Trésorerie et Business Plan."
                          : "Activez ce module pour accéder aux fonctionnalités de business plan."
                        }
                      </p>
                    </div>
                    <Switch
                      id="bp-toggle"
                      checked={bpEnabled}
                      onCheckedChange={(checked) => {
                        if (checked) enableBP();
                      }}
                      disabled={bpEnabled}
                    />
                  </div>
                  
                  {bpEnabled && (
                    <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <Sparkles className="h-4 w-4" />
                        <span className="font-medium">Module activé !</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Utilisez le toggle dans le header pour basculer entre les modes Trésorerie et Business Plan.
                      </p>
                    </div>
                  )}
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
                    onClick={startTour}
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

          <TabsContent value="businessplan">
            <BPSettingsCard />
          </TabsContent>

          <TabsContent value="trash">
            <TrashCard />
          </TabsContent>

          <TabsContent value="exports">
            <DataExportsCard />
          </TabsContent>

          <TabsContent value="profile">
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
          </TabsContent>

          <TabsContent value="security">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Sécurité</CardTitle>
                <CardDescription>Gérez la sécurité de votre compte</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Les options de sécurité avancées seront disponibles prochainement.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
