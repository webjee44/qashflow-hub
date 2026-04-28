import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, AlertCircle, Landmark, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGroupBalances } from '@/hooks/useGroupBalances';
import { useGroupRefreshBalances } from '@/hooks/useGroupRefreshBalances';
import { useCompany } from '@/hooks/useCompany';
import { CompanyCard } from '@/components/group/CompanyCard';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatCooldown = (ms: number): string => {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
};

export default function GroupOverview() {
  const navigate = useNavigate();
  const { setCurrentCompany, companies: rawCompanies } = useCompany();
  const { companies, consolidatedBalance, criticalAlerts, totalAlerts, isLoading } = useGroupBalances();
  const companyIds = companies.map(c => c.companyId);
  const { refresh, isRefreshing, cooldownRemainingMs, lastRefreshAt, canRefresh, isUnsupported } =
    useGroupRefreshBalances(companyIds);

  const handleCompanyClick = (companyId: string) => {
    const company = rawCompanies.find(c => c.id === companyId);
    if (company) {
      setCurrentCompany(company);
      navigate('/dashboard');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Vue groupe"
        subtitle="Synthèse consolidée de toutes vos sociétés"
        actions={
          isUnsupported ? null : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refresh}
                      disabled={!canRefresh}
                      className="gap-2"
                    >
                      {isRefreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Actualiser les soldes
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {cooldownRemainingMs > 0 ? (
                    <p>Disponible dans {formatCooldown(cooldownRemainingMs)}</p>
                  ) : isRefreshing ? (
                    <p>Synchronisation en cours…</p>
                  ) : (
                    <p>Force la synchro avec vos banques (cooldown 5 min)</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        }
      />

      {lastRefreshAt && !isUnsupported && (
        <p className="text-xs text-muted-foreground -mt-4">
          Dernière actualisation manuelle :{' '}
          {formatDistanceToNow(lastRefreshAt, { addSuffix: true, locale: fr })}
        </p>
      )}

      {/* Critical alerts banner */}
      {criticalAlerts > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {criticalAlerts} alerte{criticalAlerts > 1 ? 's' : ''} critique{criticalAlerts > 1 ? 's' : ''} nécessite{criticalAlerts > 1 ? 'nt' : ''} votre attention
          </AlertDescription>
        </Alert>
      )}

      {/* Hero consolidated card */}
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Solde consolidé</p>
                  <p className={`text-3xl font-bold tracking-tight ${consolidatedBalance >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                    {formatCurrency(consolidatedBalance)}
                  </p>
                </div>
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">{companies.length}</p>
                      <p className="text-xs text-muted-foreground">Société{companies.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {companies.reduce((s, c) => s + c.accountCount, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Comptes</p>
                    </div>
                  </div>
                  {totalAlerts > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <div>
                        <p className="text-lg font-semibold text-destructive">{totalAlerts}</p>
                        <p className="text-xs text-muted-foreground">Alerte{totalAlerts > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Company grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company, index) => (
            <CompanyCard
              key={company.companyId}
              company={company}
              index={index}
              onClick={() => handleCompanyClick(company.companyId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
