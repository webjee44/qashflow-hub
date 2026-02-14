import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

const HEARTBEAT_INTERVAL = 60_000; // 1 minute

function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Tracks user activity: logs a "login" event on mount,
 * then sends "heartbeat" events every minute with cumulative duration.
 */
export function useActivityTracker() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const orgId = currentOrganization?.id || null;
    const sessionId = generateSessionId();
    sessionIdRef.current = sessionId;
    startTimeRef.current = Date.now();

    // Log login event
    supabase.from('user_activity_logs').insert({
      user_id: user.id,
      organization_id: orgId,
      event_type: 'login',
      session_id: sessionId,
      duration_seconds: 0,
    } as any).then(() => {});

    // Heartbeat every minute
    intervalRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      supabase.from('user_activity_logs').insert({
        user_id: user.id,
        organization_id: orgId,
        event_type: 'heartbeat',
        session_id: sessionId,
        duration_seconds: 60, // each heartbeat = 1 minute
      } as any).then(() => {});
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id, currentOrganization?.id]);
}
