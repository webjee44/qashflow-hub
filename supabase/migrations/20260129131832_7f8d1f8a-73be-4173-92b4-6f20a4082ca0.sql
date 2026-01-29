-- Tighten overly-permissive RLS policy on bridge_sync_queue
-- Previous policy used USING (true) / WITH CHECK (true) which linter flags.

DROP POLICY IF EXISTS "Service role can manage sync queue" ON public.bridge_sync_queue;

CREATE POLICY "Service role can manage sync queue"
ON public.bridge_sync_queue
FOR ALL
TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');
