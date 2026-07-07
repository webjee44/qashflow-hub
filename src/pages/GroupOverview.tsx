import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, AlertCircle, Landmark, RefreshCw, TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGroupBalances } from '@/hooks/useGroupBalances';
import { useGroupFlowSummary } from '@/hooks/useGroupFlowSummary';
import { useCompany } from '@/hooks/useCompany';
import { CompanyCard } from '@/components/group/CompanyCard';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const NEUTRALIZE_KEY = 'group_neutralize_intercos';

export default function GroupOverview() {
  const navigate = useNavigate();
  const { setCurrentCompany, companies: rawCompanies } = useCompany();
  const { companies, consolidatedBalance, criticalAlerts, totalAlerts, isLoading } = useGroupBalances();

  const [neutralize, setNeutralize] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const v = window.localStorage.getItem(NEUTRALIZE_KEY);
    return v === null ? true : v === 'true';
  });
  const setNeutralizePersist = (v: boolean) => {
    setNeutralize(v);
    try { window.localStorage.setItem(NEUTRALIZE_KEY, String(v)); } catch { /* noop */ }
  };

  const flowsQ = useGroupFlowSummary(rawCompanies.map(c => c.id), 30);
  const flows = flowsQ.data;

  const handleCompanyClick = (companyId: string) => {
    const company = rawCompanies.find(c => c.id === companyId);
    if (company) {
      setCurrentCompany(company);
      navigate('/dashboard');
    }
  };

  const displayedInflow = flows ? (neutralize ? flows.neutralizedInflow : flows.grossInflow) : 0;
  const displayedOutflow = flows ? (neutralize ? flows.neutralizedOutflow : flows.grossOutflow) : 0;
  const displayedNet = flows ? (neutralize ? flows.neutralizedNet : flows.grossNet) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Vue groupe"
        subtitle="Synthèse consolidée de toutes vos sociétés"
      />

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
                  {(() => {
                    const lastSync = companies.reduce<string | null>((max, c) => {
                      if (!c.lastSyncAt) return max;
                      if (!max || c.lastSyncAt > max) return c.lastSyncAt;
                      return max;
                    }, null);
                    if (!lastSync) return null;
                    return (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                        <RefreshCw className="h-3 w-3" />
                        Dernière synchronisation {formatDistanceToNow(new Date(lastSync), { addSuffix: true, locale: fr })}
                      </p>
                    );
                  })()}
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

      {/* Consolidated flows (30j) with intercompany neutralization toggle */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Flux consolidés (30 derniers jours)</h2>
            <p className="text-xs text-muted-foreground">
              Somme des encaissements et décaissements de toutes les sociétés du groupe.
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Switch
                  id="neutralize"
                  checked={neutralize}
                  onCheckedChange={setNeutralizePersist}
                />
                <Label htmlFor="neutralize" className="text-sm cursor-pointer">
                  Neutraliser les flux intergroupe
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Exclut les jambes des liens intercompany (auto ou confirmés) des agrégats consolidés.
              N'affecte jamais les trésoreries par société.
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                Encaissements
              </p>
              {flowsQ.isLoading ? (
                <Skeleton className="h-7 w-32 mt-1" />
              ) : (
                <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(displayedInflow)}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                Décaissements
              </p>
              {flowsQ.isLoading ? (
                <Skeleton className="h-7 w-32 mt-1" />
              ) : (
                <p className="text-2xl font-bold tabular-nums mt-1">{formatCurrency(displayedOutflow)}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Net</p>
              {flowsQ.isLoading ? (
                <Skeleton className="h-7 w-32 mt-1" />
              ) : (
                <p className={`text-2xl font-bold tabular-nums mt-1 ${displayedNet >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                  {formatCurrency(displayedNet)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {neutralize && flows && flows.neutralizedCount > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="h-3 w-3" />
            {flows.neutralizedCount} jambe{flows.neutralizedCount > 1 ? 's' : ''} intergroupe neutralisée{flows.neutralizedCount > 1 ? 's' : ''} — volume {formatCurrency(flows.neutralizedVolume)}
          </p>
        )}
      </div>

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
