import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { CompanyList } from '@/components/settings/CompanyList';
import { BPSettingsCard } from '@/components/settings/BPSettingsCard';
import { OrganizationCard } from '@/components/settings/OrganizationCard';

import { AuditLogsCard } from '@/components/settings/AuditLogsCard';
import { TrashCard } from '@/components/settings/TrashCard';
import { DataExportsCard } from '@/components/settings/DataExportsCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, User, Shield, TrendingUp, History, Trash2, HardDrive } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <Header title="Paramètres" subtitle="Gérez vos sociétés et préférences" />

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
            <TabsTrigger value="businessplan" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Business Plan
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <History className="w-4 h-4" />
              Audit
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

          <TabsContent value="businessplan">
            <BPSettingsCard />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogsCard />
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
