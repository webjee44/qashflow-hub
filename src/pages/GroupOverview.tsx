import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, AlertCircle, TrendingUp, Landmark } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGroupBalances } from '@/hooks/useGroupBalances';
import { useCompany } from '@/hooks/useCompany';
import { CompanyCard } from '@/components/group/CompanyCard';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export default function GroupOverview() {
  const navigate = useNavigate();
  const { setCurrentCompany, companies: rawCompanies } = useCompany();
  const { companies, consolidatedBalance, criticalAlerts, totalAlerts, isLoading } = useGroupBalances();

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
