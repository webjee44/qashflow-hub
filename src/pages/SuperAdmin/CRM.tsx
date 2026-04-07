import { useState } from 'react';
import { SuperAdminLayout } from '@/components/superadmin/SuperAdminLayout';
import { useCRMPipeline, PIPELINE_STAGES, type CRMUser, type PipelineStageKey } from '@/hooks/useCRMPipeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Clock, LogIn, ExternalLink, X, CheckCircle2, XCircle, User, Mail, Calendar, Shield, Database, Tag, Zap, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h${rm}m` : `${h}h`;
}

// ── Funnel Chart ──
function FunnelChart({ funnel }: { funnel: ReturnType<typeof useCRMPipeline>['funnel'] }) {
  const maxCount = funnel[0]?.cumulativeCount || 1;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Entonnoir de conversion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {funnel.map((step, i) => {
          const widthPercent = Math.max((step.cumulativeCount / maxCount) * 100, 8);
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

// ── Compact User Card ──
function CompactUserCard({ user, isActive, onClick }: { user: CRMUser; isActive: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-2.5 rounded-lg border transition-all hover:bg-accent/50 cursor-pointer ${
        isActive ? 'border-primary bg-primary/5 shadow-sm' : 'bg-card border-border'
      }`}
    >
      <p className="text-sm font-medium truncate">{user.full_name || 'Sans nom'}</p>
      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      {user.last_active_at && (
        <p className="text-xs text-muted-foreground mt-0.5">
          <Clock className="inline h-3 w-3 mr-1" />
          {format(new Date(user.last_active_at), 'dd/MM/yy HH:mm', { locale: fr })}
        </p>
      )}
    </button>
  );
}

// ── Detail Panel (HubSpot-style) ──
function UserDetailPanel({ user, onClose }: { user: CRMUser; onClose: () => void }) {
  const stage = PIPELINE_STAGES.find(s => s.key === user.pipeline_stage);

  const handleImpersonate = async () => {
    const { data, error } = await supabase.functions.invoke('admin-impersonate', {
      body: { targetUserId: user.user_id },
    });
    if (error || !data?.success) {
      console.error('[Impersonate] Error:', error || data?.error);
      return;
    }
    const params = new URLSearchParams();
    params.set('email', data.email);
    if (data.token_hash) params.set('token_hash', data.token_hash);
    if (data.email_otp) params.set('email_otp', data.email_otp);
    window.open(`${window.location.origin}/impersonate-landing?${params.toString()}`, '_blank');
  };

  const milestones = [
    { label: 'Inscription', done: true, icon: User },
    { label: 'Onboarding', done: user.onboarding_completed, icon: CheckCircle2 },
    { label: 'Banque connectée', done: user.has_bank, icon: Database },
    { label: '1ère catégorisation', done: user.has_categorized, icon: Tag },
    { label: 'Utilisation > 1h', done: user.total_time_seconds > 3600, icon: Clock },
    { label: 'Power User', done: user.total_time_seconds > 18000 && user.total_logins > 10 && user.has_automation, icon: Zap },
  ];

  return (
    <div className="w-[400px] border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold truncate">{user.full_name || 'Sans nom'}</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Stage badge + impersonate */}
          <div className="flex items-center justify-between">
            {stage && <Badge className={stage.color}>{stage.label}</Badge>}
            <Button variant="outline" size="sm" className="gap-2" onClick={handleImpersonate}>
              <ExternalLink className="h-3.5 w-3.5" />
              Impersonation
            </Button>
          </div>

          {/* Contact info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Contact</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Inscrit le {format(new Date(user.created_at), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
              {user.last_active_at && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Dernière connexion : {format(new Date(user.last_active_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Engagement stats */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Engagement</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Temps passé</p>
                <p className="text-lg font-bold">{formatDuration(user.total_time_seconds)}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Connexions</p>
                <p className="text-lg font-bold">{user.total_logins}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Milestone timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Progression</h3>
            <div className="space-y-1">
              {milestones.map((m, i) => (
                <div key={m.label} className="flex items-center gap-3 py-1.5">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 ${
                    m.done 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {m.done ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <span className={`text-sm ${m.done ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Features status */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Fonctionnalités</h3>
            <div className="space-y-2">
              {[
                { label: 'Banque', active: user.has_bank },
                { label: 'Catégorisation', active: user.has_categorized },
                { label: 'Automatisations', active: user.has_automation },
              ].map(f => (
                <div key={f.label} className="flex items-center justify-between text-sm">
                  <span>{f.label}</span>
                  <Badge variant={f.active ? 'default' : 'secondary'} className="text-xs">
                    {f.active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Pipeline Column ──
function PipelineColumn({ stageKey, users, search, selectedUserId, onSelectUser }: { 
  stageKey: PipelineStageKey; users: CRMUser[]; search: string; 
  selectedUserId: string | null; onSelectUser: (u: CRMUser) => void;
}) {
  const stage = PIPELINE_STAGES.find(s => s.key === stageKey)!;
  const filtered = search
    ? users.filter(u => (u.full_name || '').toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
    : users;

  return (
    <div className="flex flex-col min-w-[220px] max-w-[240px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Badge className={stage.color}>{stage.label}</Badge>
        <span className="text-sm font-semibold text-muted-foreground">{filtered.length}</span>
      </div>
      <ScrollArea className="flex-1 max-h-[60vh]">
        <div className="space-y-1.5 pr-2">
          {filtered.map(u => (
            <CompactUserCard
              key={u.user_id}
              user={u}
              isActive={selectedUserId === u.user_id}
              onClick={() => onSelectUser(u)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Aucun utilisateur</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Main Page ──
export default function CRM() {
  const { funnel, grouped, totalUsers, isLoading } = useCRMPipeline();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<CRMUser | null>(null);
  const normalizedSearch = search.toLowerCase().trim();

  return (
    <SuperAdminLayout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* Main content */}
        <div className="flex-1 overflow-auto p-8 space-y-6">
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
              <FunnelChart funnel={funnel} />

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

                <div className="flex gap-3 overflow-x-auto pb-4">
                  {PIPELINE_STAGES.map(stage => (
                    <PipelineColumn
                      key={stage.key}
                      stageKey={stage.key}
                      users={grouped[stage.key]}
                      search={normalizedSearch}
                      selectedUserId={selectedUser?.user_id ?? null}
                      onSelectUser={setSelectedUser}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Detail panel */}
        {selectedUser && (
          <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
        )}
      </div>
    </SuperAdminLayout>
  );
}
