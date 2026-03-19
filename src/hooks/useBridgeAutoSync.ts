import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';
import { toast } from 'sonner';
import { logError, logInfo } from '@/lib/logger';

const SYNC_STORAGE_KEY = 'bridge_last_auto_sync';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function useBridgeAutoSync() {
  const { currentCompany, refetch } = useCompany();
  const queryClient = useQueryClient();
  const hasSynced = useRef(false);

  useEffect(() => {
    // Only run once per mount and if company has a valid Bridge UUID
    const bridgeUuid = currentCompany?.bridge_user_uuid;
    if (hasSynced.current || !bridgeUuid || !UUID_REGEX.test(bridgeUuid)) {
      return;
    }

    // Check cooldown to avoid syncing too frequently
    const lastSync = localStorage.getItem(SYNC_STORAGE_KEY);
    if (lastSync) {
      const lastSyncTime = parseInt(lastSync, 10);
      if (Date.now() - lastSyncTime < SYNC_COOLDOWN_MS) {
        logInfo('Bridge auto-sync skipped: cooldown active');
        return;
      }
    }

    hasSynced.current = true;

    const runAutoSync = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        logInfo('Starting Bridge auto-sync...');

        const { data, error } = await supabase.functions.invoke('bridge-sync', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: {
            action: 'full-sync',
            bridge_user_uuid: currentCompany.bridge_user_uuid,
            company_id: currentCompany.id,
          },
        });

        if (error || !data?.success) {
          logError('Bridge auto-sync failed:', data?.error || error);
          return;
        }

        // Update last sync time
        localStorage.setItem(SYNC_STORAGE_KEY, Date.now().toString());

        const balance = data.totalBalance?.toLocaleString('fr-FR', { 
          style: 'currency', 
          currency: 'EUR' 
        }) || '0 €';

        toast.success('Synchronisation Bridge automatique', {
          description: `${data.accounts} comptes • ${balance} • ${data.inserted + data.updated} transactions`,
        });

        await refetch();
        await queryClient.invalidateQueries({ queryKey: ['transactions'] });
        await queryClient.invalidateQueries({ queryKey: ['bank_balance'] });
      } catch (err) {
        logError('Bridge auto-sync error:', err);
      }
    };

    runAutoSync();
  }, [currentCompany, refetch]);
}
