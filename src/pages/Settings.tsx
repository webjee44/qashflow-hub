import { motion } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { CompanyList } from '@/components/settings/CompanyList';
import { OrganizationCard } from '@/components/settings/OrganizationCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Building2, User, Play } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';

export default function Settings() {
  const { user } = useAuth();
  const { startTour, isCompleted } = useOnboarding();

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
        </Tabs>
      </motion.div>
    </div>
  );
}
