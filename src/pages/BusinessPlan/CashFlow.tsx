import { motion } from 'framer-motion';
import { Wallet, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CashFlow() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Trésorerie Prévisionnelle</h1>
          <p className="text-muted-foreground mt-1">Projection du cash-flow basée sur le Business Plan</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          Paramètres
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Évolution de la trésorerie</CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Wallet className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Aucune projection</p>
              <p className="text-sm">La trésorerie prévisionnelle sera calculée</p>
              <p className="text-sm">à partir de vos revenus et charges prévus</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle>Paramètres de trésorerie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">Délai de paiement clients</p>
              <p className="text-2xl font-bold text-foreground">30 jours</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">Délai de paiement fournisseurs</p>
              <p className="text-2xl font-bold text-foreground">30 jours</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
