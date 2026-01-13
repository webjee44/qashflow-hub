import { motion } from 'framer-motion';
import { FileSpreadsheet, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ProfitLoss() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Compte de Résultat</h1>
          <p className="text-muted-foreground mt-1">P&L prévisionnel basé sur vos hypothèses</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exporter
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>P&L Prévisionnel</CardTitle>
          </CardHeader>
          <CardContent className="h-[500px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Aucune donnée</p>
              <p className="text-sm">Le compte de résultat sera calculé automatiquement</p>
              <p className="text-sm">à partir de vos hypothèses de revenus et charges</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
