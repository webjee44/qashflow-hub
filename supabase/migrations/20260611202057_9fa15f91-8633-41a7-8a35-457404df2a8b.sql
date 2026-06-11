
-- 1) Fix storage data-exports INSERT policy: scope to org admins + their folder
DROP POLICY IF EXISTS "System can insert exports" ON storage.objects;
CREATE POLICY "Org admins can insert their exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'data-exports'
  AND (storage.foldername(name))[1] IN (
    SELECT (om.organization_id)::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.role IN ('owner'::app_role, 'admin'::app_role)
  )
);

-- 2) Restrict service-role policies to the actual service_role principal
--    (the JWT-claim check is bypassable via crafted tokens)
DROP POLICY IF EXISTS "Service role manages run items" ON public.automation_run_items;
CREATE POLICY "Service role manages run items"
ON public.automation_run_items
AS PERMISSIVE FOR ALL
TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages runs" ON public.automation_runs;
CREATE POLICY "Service role manages runs"
ON public.automation_runs
AS PERMISSIVE FOR ALL
TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on bridge accounts" ON public.bridge_accounts;
CREATE POLICY "Service role full access on bridge accounts"
ON public.bridge_accounts
AS PERMISSIVE FOR ALL
TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage sync queue" ON public.bridge_sync_queue;
CREATE POLICY "Service role can manage sync queue"
ON public.bridge_sync_queue
AS PERMISSIVE FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- 3) Restrict organizations.stripe_* visibility to org owners/admins (column-level)
--    Members keep access to all other columns through existing RLS.
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.organizations FROM authenticated;
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.organizations FROM anon;
GRANT SELECT (stripe_customer_id, stripe_subscription_id) ON public.organizations TO service_role;

-- 4) Make the company_active_bridge_accounts view security_invoker
ALTER VIEW public.company_active_bridge_accounts SET (security_invoker = on);

-- 5) Document company_secrets read intent: only service role may read.
COMMENT ON TABLE public.company_secrets IS
  'Sensitive third-party credentials. Reads restricted to service_role (no SELECT policy for client roles). Mutations gated by RLS per-company ownership.';

-- 6) Lock down SECURITY DEFINER administrative functions: revoke anon execute, keep
--    authenticated for those that authorize internally, restrict admin-only ones.
REVOKE EXECUTE ON FUNCTION public.assign_superadmin_role(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_superadmin_tenant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_organization_cascade(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_demo_companies(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_superadmin_all_members() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_superadmin_crm_pipeline() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_superadmin_global_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_superadmin_org_companies(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_superadmin_org_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_superadmin_org_stats_with_engagement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_email_for_superadmin(uuid) FROM PUBLIC, anon, authenticated;

-- Anonymous users have no business calling any application function
REVOKE EXECUTE ON FUNCTION public.add_company_member_by_email(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_organization_member_by_email(uuid, text, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_organization_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_company_member_access(uuid, uuid, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_company_members_with_email(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_org_engagement_stats(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_org_members_with_company_access(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_organization_billing(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reintegrate_company_bridge_account(uuid, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_company_bank_stats(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.company_has_secret(uuid, text) FROM anon, PUBLIC;

-- 7) Realtime: transactions stream wasn't consumed by the frontend and broadcasting
--    every change to all authenticated channels is a data-leak risk. Remove the
--    table from the realtime publication.
ALTER PUBLICATION supabase_realtime DROP TABLE public.transactions;
