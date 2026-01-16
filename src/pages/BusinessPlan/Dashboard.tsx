import { motion } from 'framer-motion';
import { Plus, FileSpreadsheet, TrendingUp, Calendar, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBPSettings } from '@/hooks/useBPSettings';
import { useRevenueStreams } from '@/hooks/useRevenueStreams';
import { useCompany } from '@/hooks/useCompany';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function BPDashboard() {
  const { settings, isLoading: settingsLoading } = useBPSettings();
  const { streams, isLoading: streamsLoading } = useRevenueStreams();
  const { currentCompany } = useCompany();

  const isLoading = settingsLoading || streamsLoading;
  const hasBPData = streams && streams.length > 0;

  const startDate = settings?.bp_start_date 
    ? format(new Date(settings.bp_start_date), 'MMMM yyyy', { locale: fr })
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Business Plan</h1>
        <p className="text-muted-foreground mt-1">
          {currentCompany?.name || 'Sélectionnez une société'}
        </p>
      </div>

      {hasBPData ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">
                    {currentCompany?.name || 'Business Plan'}
                  </CardTitle>
                  <CardDescription>
                    {startDate && `Démarrage : ${startDate}`} • {settings?.bp_years || 3} ans
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Sources de revenus</p>
                  <p className="text-lg font-semibold">{streams.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Durée</p>
                  <p className="text-lg font-semibold">{settings?.bp_years || 3} ans</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Délai client</p>
                  <p className="text-lg font-semibold">{settings?.customer_payment_delay || 30}j</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Délai fournisseur</p>
                  <p className="text-lg font-semibold">{settings?.supplier_payment_delay || 30}j</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild>
                  <Link to="/bp/revenus">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Continuer le BP
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/bp/pnl">
                    Voir le compte de résultat
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-6">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Aucun business plan</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Créez votre premier business plan pour projeter vos revenus, charges et rentabilité sur plusieurs années.
          </p>
          <Button size="lg" asChild>
            <Link to="/bp/revenus">
              <Plus className="h-5 w-5 mr-2" />
              Nouveau Business Plan
            </Link>
          </Button>
        </motion.div>
      )}

      {hasBPData && (
        <div className="grid gap-4 md:grid-cols-3">
          <Link to="/bp/revenus">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  Revenus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Gérez vos sources de revenus et hypothèses de croissance
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/bp/charges">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-destructive" />
                  Charges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Définissez vos charges fixes, variables et personnel
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/bp/pnl">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  Résultats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Consultez votre compte de résultat et bilans prévisionnels
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  );
}
