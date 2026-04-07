import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CRMUser {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  onboarding_completed: boolean;
  has_bank: boolean;
  has_categorized: boolean;
  total_time_seconds: number;
  total_logins: number;
  has_automation: boolean;
  pipeline_stage: string;
  last_active_at: string | null;
}

export const PIPELINE_STAGES = [
  { key: 'signed_up', label: 'Inscrit', color: 'bg-muted text-muted-foreground' },
  { key: 'onboarding_complete', label: 'Onboarding complet', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  { key: 'bank_connected', label: 'Banque connectée', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  { key: 'first_categorization', label: '1ère catégorisation', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  { key: 'active_1h', label: 'Utilisation > 1h', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  { key: 'power_user', label: 'Power User', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' },
] as const;

export type PipelineStageKey = typeof PIPELINE_STAGES[number]['key'];

export interface FunnelStep {
  key: PipelineStageKey;
  label: string;
  count: number;
  cumulativeCount: number;
  conversionRate: number;
  dropOffRate: number;
}

function computeCumulativeCounts(users: CRMUser[]): Map<PipelineStageKey, number> {
  const stageOrder: PipelineStageKey[] = PIPELINE_STAGES.map(s => s.key);
  const stageIndex: Record<string, number> = {};
  stageOrder.forEach((k, i) => stageIndex[k] = i);

  // For cumulative: a user at stage N also "passed" stages 0..N
  const cumulative = new Map<PipelineStageKey, number>();
  stageOrder.forEach(k => cumulative.set(k, 0));

  for (const u of users) {
    const idx = stageIndex[u.pipeline_stage] ?? 0;
    for (let i = 0; i <= idx; i++) {
      cumulative.set(stageOrder[i], (cumulative.get(stageOrder[i]) || 0) + 1);
    }
  }
  return cumulative;
}

export function useCRMPipeline() {
  const query = useQuery({
    queryKey: ['crm-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_superadmin_crm_pipeline');
      if (error) throw error;
      return (data || []) as CRMUser[];
    },
  });

  const users = query.data || [];
  const totalUsers = users.length;

  // Group users by their current stage
  const grouped: Record<PipelineStageKey, CRMUser[]> = {
    signed_up: [], onboarding_complete: [], bank_connected: [],
    first_categorization: [], active_1h: [], power_user: [],
  };
  for (const u of users) {
    const stage = u.pipeline_stage as PipelineStageKey;
    if (grouped[stage]) grouped[stage].push(u);
    else grouped.signed_up.push(u);
  }

  // Cumulative counts for funnel
  const cumulative = computeCumulativeCounts(users);

  const funnel: FunnelStep[] = PIPELINE_STAGES.map((stage, i) => {
    const cumulativeCount = cumulative.get(stage.key) || 0;
    const prevCumulative = i === 0 ? totalUsers : (cumulative.get(PIPELINE_STAGES[i - 1].key) || 0);
    const conversionRate = prevCumulative > 0 ? (cumulativeCount / prevCumulative) * 100 : 0;
    const dropOffRate = 100 - conversionRate;
    return {
      key: stage.key,
      label: stage.label,
      count: grouped[stage.key].length,
      cumulativeCount,
      conversionRate: i === 0 ? 100 : conversionRate,
      dropOffRate: i === 0 ? 0 : dropOffRate,
    };
  });

  return { ...query, users, grouped, funnel, totalUsers };
}
