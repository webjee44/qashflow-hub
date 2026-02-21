import { Users, Building2, FileText, Receipt, Activity, Clock, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { StatsCard } from '@/components/superadmin/StatsCard';
import { useSuperAdminGlobalStats, useSuperAdminOrgStats, OrgStats } from '@/hooks/useSuperAdmin';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo } from 'react';

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0 min';
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
}

const planBadge: Record<string, string> = {
  free: 'bg-muted text-muted-foreground',
  pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  business: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

const statusBadge: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  trialing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  canceled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  past_due: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

function EngagementBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function OrgRow({ org, maxTime, rank }: { org: OrgStats; maxTime: number; rank: number }) {
  const navigate = useNavigate();
  const totalTime = Number(org.total_time_seconds || 0);
  const totalLogins = Number(org.total_logins || 0);

  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer group"
      onClick={() => navigate(`/superadmin/organizations/${org.organization_id}`)}
    >
      {/* Rank */}
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
        {rank}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-foreground truncate">{org.name}</span>
          {org.is_demo && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-300 text-violet-600 dark:text-violet-400">
              DÉMO
            </Badge>
          )}
          <Badge className={`text-[10px] px-1.5 py-0 ${planBadge[org.plan] || planBadge.free}`}>
            {org.plan}
          </Badge>
          <Badge className={`text-[10px] px-1.5 py-0 ${statusBadge[org.subscription_status] || statusBadge.trialing}`}>
            {org.subscription_status}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{org.owner_email || `@${org.slug}`}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{org.member_count}</span>
          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{org.company_count}</span>
          <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{org.bp_count} BP</span>
        </div>
      </div>

      {/* Engagement */}
      <div className="w-40 shrink-0 space-y-1">
        <EngagementBar value={totalTime} max={maxTime} />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(totalTime)}</span>
          <span>{totalLogins} connexions</span>
        </div>
      </div>

      {/* Last active */}
      <div className="w-24 shrink-0 text-right">
        {org.last_active_at ? (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(org.last_active_at), { addSuffix: true, locale: fr })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">Jamais</span>
        )}
      </div>

      {/* Arrow */}
      <ArrowUpRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
    </div>
  );
}

export default function SuperAdminDashboard() {
  const { data: globalStats, isLoading: statsLoading } = useSuperAdminGlobalStats();
  const { data: orgStats, isLoading: orgsLoading } = useSuperAdminOrgStats();

  const rankedOrgs = useMemo(() => {
    if (!orgStats) return [];
    return [...orgStats].sort((a, b) => {
      // Score composite : sociétés + membres + BP + engagement
      const scoreA = Number(a.company_count || 0) * 3 + Number(a.member_count || 0) * 2 + Number(a.bp_count || 0);
      const scoreB = Number(b.company_count || 0) * 3 + Number(b.member_count || 0) * 2 + Number(b.bp_count || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = Number(a.total_time_seconds || 0);
      const timeB = Number(b.total_time_seconds || 0);
      if (timeB !== timeA) return timeB - timeA;
      return Number(b.total_logins || 0) - Number(a.total_logins || 0);
    });
  }, [orgStats]);

  const maxTime = useMemo(() => {
    if (!rankedOrgs.length) return 1;
    return Math.max(Number(rankedOrgs[0]?.total_time_seconds || 0), 1);
  }, [rankedOrgs]);

  const activeOrgs = useMemo(() => {
    return rankedOrgs.filter(o => Number(o.total_time_seconds || 0) > 0).length;
  }, [rankedOrgs]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {statsLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              <StatsCard title="Utilisateurs" value={globalStats?.total_users || 0} icon={Users} description="Comptes créés" />
              <StatsCard title="Organisations" value={globalStats?.total_organizations || 0} icon={Building2} description="Clients inscrits" />
              <StatsCard title="Orgs actives" value={activeOrgs} icon={Activity} description="Avec au moins 1 session" />
              <StatsCard title="Business Plans" value={globalStats?.total_business_plans || 0} icon={FileText} description="BP créés" />
              <StatsCard title="Transactions" value={globalStats?.total_transactions || 0} icon={Receipt} description="Opérations enregistrées" />
            </>
          )}
        </div>

        {/* Ranked Organizations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
                Classement par engagement
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Organisations triées par temps d'utilisation cumulé
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/superadmin/organizations">Voir tout</a>
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            {orgsLoading ? (
              <div className="space-y-3 p-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : rankedOrgs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucune organisation pour le moment</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {rankedOrgs.map((org, i) => (
                  <OrgRow key={org.organization_id} org={org} maxTime={maxTime} rank={i + 1} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
