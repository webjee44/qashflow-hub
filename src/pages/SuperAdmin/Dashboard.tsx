import { Users, Building2, FileText, Receipt } from 'lucide-react';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { StatsCard } from '@/components/superadmin/StatsCard';
import { useSuperAdminGlobalStats, useSuperAdminOrgStats } from '@/hooks/useSuperAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { OrgCard } from '@/components/superadmin/OrgCard';

export default function SuperAdminDashboard() {
  const { data: globalStats, isLoading: statsLoading } = useSuperAdminGlobalStats();
  const { data: orgStats, isLoading: orgsLoading } = useSuperAdminOrgStats();

  const recentOrgs = orgStats?.slice(0, 5) || [];

  return (
    <SuperAdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble de la plateforme
          </p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsLoading ? (
            <>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </>
          ) : (
            <>
              <StatsCard
                title="Utilisateurs"
                value={globalStats?.total_users || 0}
                icon={Users}
                description="Comptes créés"
              />
              <StatsCard
                title="Organisations"
                value={globalStats?.total_organizations || 0}
                icon={Building2}
                description="Clients actifs"
              />
              <StatsCard
                title="Business Plans"
                value={globalStats?.total_business_plans || 0}
                icon={FileText}
                description="BP créés"
              />
              <StatsCard
                title="Transactions"
                value={globalStats?.total_transactions || 0}
                icon={Receipt}
                description="Opérations enregistrées"
              />
            </>
          )}
        </div>

        {/* Recent Organizations */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">
              Dernières organisations
            </h2>
            <a
              href="/superadmin/organizations"
              className="text-sm text-primary hover:underline"
            >
              Voir tout
            </a>
          </div>

          {orgsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : recentOrgs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune organisation pour le moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {recentOrgs.map((org) => (
                <OrgCard key={org.organization_id} organization={org} />
              ))}
            </div>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
