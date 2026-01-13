import { motion } from 'framer-motion';
import { Plus, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function RevenueAssumptions() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hypothèses de Revenus</h1>
          <p className="text-muted-foreground mt-1">Définissez vos flux de revenus et projections</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un flux
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Flux de revenus</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Aucun flux de revenus</p>
              <p className="text-sm mb-4">Créez votre premier flux de revenus pour commencer</p>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un flux de revenus
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
