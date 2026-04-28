import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logError, logInfo } from '@/lib/logger';

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'group_last_manual_balance_refresh';

interface RefreshResult {
  refreshed_users: number;
  refreshed_items: number;
  skipped_items: number;
  refresh_errors: number;
  updated_accounts: number;
  message?: string;
}

/**
 * Manual balance refresh for the entire group view.
 * - Cooldown prevents spamming Bridge (rate-limited per item).
 * - Scope is balances only — does NOT touch transactions.
 * - The actual fresh balance arrives from Bridge asynchronously (the call
 *   itself already waits ~4s, but slow banks may take longer).
 */
export function useGroupRefreshBalances(companyIds: string[]) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Re-render every second while a cooldown is active so the countdown ticks.
  useEffect(() => {
    const lastStr = localStorage.getItem(STORAGE_KEY);
    if (!lastStr) return;
    const last = parseInt(lastStr, 10);
    if (Number.isNaN(last)) return;
    if (Date.now() - last >= COOLDOWN_MS) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [now]);

  const lastRefreshAt: Date | null = (() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    return Number.isNaN(ts) ? null : new Date(ts);
  })();

  const cooldownRemainingMs = lastRefreshAt
    ? Math.max(0, COOLDOWN_MS - (now - lastRefreshAt.getTime()))
    : 0;

  const refresh = useCallback(async () => {
    if (companyIds.length === 0) {
      toast.info('Aucune société à actualiser');
      return;
    }

    if (cooldownRemainingMs > 0) {
      const minutes = Math.ceil(cooldownRemainingMs / 60000);
      toast.info(`Synchro déjà déclenchée. Réessayez dans ${minutes} min.`);
      return;
    }

    setIsRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Vous devez être connecté');
        return;
      }

      logInfo(`[useGroupRefreshBalances] Refreshing ${companyIds.length} companies`);

      const { data, error } = await supabase.functions.invoke<RefreshResult & { success: boolean; error?: string }>(
        'bridge-refresh-balances',
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { company_ids: companyIds },
        }
      );

      if (error || !data?.success) {
        const msg = data?.error || error?.message || 'Erreur lors de la synchronisation';
        toast.error(msg);
        return;
      }

      // Persist cooldown only on actual success
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      setNow(Date.now());

      // Invalidate the caches that drive the group view and per-company balance
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['group_balances'] }),
        queryClient.invalidateQueries({ queryKey: ['bank_balance'] }),
      ]);

      if (data.refreshed_items === 0 && data.updated_accounts === 0) {
        toast.info(data.message || 'Aucune banque connectée à actualiser');
        return;
      }

      const partialErrors = data.refresh_errors > 0;
      const description = `${data.refreshed_items} banque${data.refreshed_items > 1 ? 's' : ''} • ${data.updated_accounts} compte${data.updated_accounts > 1 ? 's' : ''} mis à jour`;

      if (partialErrors) {
        toast.warning('Synchro partielle', {
          description: `${description}. ${data.refresh_errors} banque(s) n'ont pas répondu.`,
        });
      } else {
        toast.success('Synchronisation déclenchée', {
          description: `${description}. Les nouveaux soldes peuvent prendre 1 à 2 minutes selon vos banques.`,
        });
      }
    } catch (err) {
      logError('[useGroupRefreshBalances] error', err);
      toast.error('Erreur lors de la synchronisation');
    } finally {
      setIsRefreshing(false);
    }
  }, [companyIds, cooldownRemainingMs, queryClient]);

  return {
    refresh,
    isRefreshing,
    cooldownRemainingMs,
    lastRefreshAt,
    canRefresh: !isRefreshing && cooldownRemainingMs === 0 && companyIds.length > 0,
  };
}
