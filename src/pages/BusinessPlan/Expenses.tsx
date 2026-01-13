import { motion } from 'framer-motion';
import { Plus, Building2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Expenses() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Charges & Personnel</h1>
          <p className="text-muted-foreground mt-1">Gérez vos charges fixes et votre masse salariale</p>
        </div>
      </div>

      <Tabs defaultValue="fixed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fixed" className="gap-2">
            <Building2 className="h-4 w-4" />
            Charges fixes
          </TabsTrigger>
          <TabsTrigger value="personnel" className="gap-2">
            <Users className="h-4 w-4" />
            Personnel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Charges fixes</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter une charge
                </Button>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Aucune charge fixe</p>
                  <p className="text-sm">Loyer, assurances, abonnements SaaS...</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="personnel">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Personnel</CardTitle>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ajouter un poste
                </Button>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium">Aucun personnel</p>
                  <p className="text-sm">Planifiez vos recrutements et salaires</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
