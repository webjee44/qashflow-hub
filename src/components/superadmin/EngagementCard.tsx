import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Clock, LogIn } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}min`;
}

interface EngagementCardProps {
  organizationId: string;
}

export function EngagementCard({ organizationId }: EngagementCardProps) {
  const { data: engagement = [], isLoading } = useQuery({
    queryKey: ['org-engagement', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_org_engagement_stats', {
        _org_id: organizationId,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const totalLogins = engagement.reduce((sum: number, u: any) => sum + Number(u.total_logins || 0), 0);
  const totalTime = engagement.reduce((sum: number, u: any) => sum + Number(u.total_time_seconds || 0), 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Engagement utilisateurs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <LogIn className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalLogins}</p>
              <p className="text-xs text-muted-foreground">Connexions totales</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatDuration(totalTime)}</p>
              <p className="text-xs text-muted-foreground">Temps cumulé</p>
            </div>
          </div>
        </div>

        {/* Per-user breakdown */}
        {engagement.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Détail par membre</p>
            <div className="divide-y divide-border rounded-lg border">
              {engagement.map((member: any) => (
                <div key={member.user_id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{member.full_name || member.email}</p>
                    {member.full_name && (
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-medium">{Number(member.total_logins)}</p>
                      <p className="text-xs text-muted-foreground">connexions</p>
                    </div>
                    <div>
                      <p className="font-medium">{formatDuration(Number(member.total_time_seconds))}</p>
                      <p className="text-xs text-muted-foreground">temps total</p>
                    </div>
                    <div className="min-w-[80px]">
                      {member.last_active_at ? (
                        <>
                          <p className="font-medium text-xs">{format(new Date(member.last_active_at), 'dd MMM yyyy', { locale: fr })}</p>
                          <p className="text-xs text-muted-foreground">dernière activité</p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Jamais connecté</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
