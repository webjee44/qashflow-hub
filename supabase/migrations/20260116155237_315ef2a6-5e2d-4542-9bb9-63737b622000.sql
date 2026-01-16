-- Fix the permissive RLS policy for audit_logs INSERT
-- Drop the old permissive policy
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Create a more restrictive INSERT policy
-- Only allow inserts where the user_id matches the authenticated user
-- or through the SECURITY DEFINER trigger function
CREATE POLICY "Users can insert their own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);