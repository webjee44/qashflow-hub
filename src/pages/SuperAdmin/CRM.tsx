import { useState } from 'react';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { useCRMPipeline, PIPELINE_STAGES, type CRMUser, type PipelineStageKey } from '@/hooks/useCRMPipeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Clock, LogIn, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h${rm}m` : `${h}h`;
}

function FunnelChart({ funnel, totalUsers }: { funnel: ReturnType<typeof useCRMPipeline>['funnel']; totalUsers: number }) {
  const maxCount = funnel[0]?.cumulativeCount || 1;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Entonnoir de conversion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {funnel.map((step, i) => {
          const widthPercent = Math.max((step.cumulativeCount / maxCount) * 100, 8);
          const stage = PIPELINE_STAGES[i];
          return (
            <div key={step.key} className="flex items-center gap-3">
              <div className="w-40 text-sm font-medium truncate">{step.label}</div>
              <div className="flex-1 relative h-8">
                <div
                  className="h-full rounded-md flex items-center px-3 text-xs font-semibold transition-all"
                  style={{ width: `${widthPercent}%`, background: `hsl(var(--primary) / ${0.3 + (1 - i / funnel.length) * 0.7})` }}
                >
                  <span className="text-primary-foreground">{step.cumulativeCount}</span>
                </div>
              </div>
              <div className="w-20 text-right text-sm text-muted-foreground">
                {i === 0 ? '100%' : `${step.conversionRate.toFixed(0)}%`}
              </div>
              {i > 0 && step.dropOffRate > 0 && (
                <div className="w-20 text-right text-xs text-destructive">
                  -{step.dropOffRate.toFixed(0)}%
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function UserCard({ user }: { user: CRMUser }) {
  const handleImpersonate = async () => {
    const { data } = await supabase.functions.invoke('admin-impersonate', {
      body: { targetUserId: user.user_id },
    });
    if (data?.url) window.open(data.url, '_blank');
  };

  return (
    <div className="p-3 rounded-lg border bg-card text-card-foreground space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user.full_name || 'Sans nom'}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleImpersonate} title="Impersonation">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(user.total_time_seconds)}</span>
        <span className="flex items-center gap-1"><LogIn className="h-3 w-3" />{user.total_logins}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Inscrit {format(new Date(user.created_at), 'dd MMM yyyy', { locale: fr })}
      </p>
    </div>
  );
}

function PipelineColumn({ stageKey, users, search }: { stageKey: PipelineStageKey; users: CRMUser[]; search: string }) {
  const stage = PIPELINE_STAGES.find(s => s.key === stageKey)!;
  const filtered = search
    ? users.filter(u => (u.full_name || '').toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
    : users;

  return (
    <div className="flex flex-col min-w-[260px] max-w-[300px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Badge className={stage.color}>{stage.label}</Badge>
        <span className="text-sm font-semibold text-muted-foreground">{filtered.length}</span>
      </div>
      <ScrollArea className="flex-1 max-h-[60vh]">
        <div className="space-y-2 pr-2">
          {filtered.map(u => <UserCard key={u.user_id} user={u} />)}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Aucun utilisateur</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function CRM() {
  const { funnel, grouped, totalUsers, isLoading } = useCRMPipeline();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.toLowerCase().trim();

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">CRM Pipeline</h1>
          <p className="text-muted-foreground">Funnel d'engagement et progression des utilisateurs</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : (
          <>
            <FunnelChart funnel={funnel} totalUsers={totalUsers} />

            <div className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4">
                {PIPELINE_STAGES.map(stage => (
                  <PipelineColumn
                    key={stage.key}
                    stageKey={stage.key}
                    users={grouped[stage.key]}
                    search={normalizedSearch}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
