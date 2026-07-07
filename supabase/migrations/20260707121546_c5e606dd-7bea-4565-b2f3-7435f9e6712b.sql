
-- =========================================================
-- S2 — DROP MULTITENANT
-- =========================================================

-- 1. Drop des policies qui référencent les tables org (avant DROP TABLE)
DROP POLICY IF EXISTS "Users can view audit logs for their organizations" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_logs;

DROP POLICY IF EXISTS "Superadmins can view all activity" ON public.user_activity_logs;
DROP POLICY IF EXISTS "Users can insert own activity" ON public.user_activity_logs;
DROP POLICY IF EXISTS "Users can update own activity" ON public.user_activity_logs;
DROP POLICY IF EXISTS "Users can view own activity" ON public.user_activity_logs;

-- 2. Drop des fonctions org (avec signatures)
DROP FUNCTION IF EXISTS public.add_organization_member_by_email(uuid, text, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.delete_organization_cascade(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.generate_org_slug(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_org_engagement_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_org_members_with_company_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_organization_billing(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_superadmin_org_companies(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_superadmin_org_stats() CASCADE;
DROP FUNCTION IF EXISTS public.get_superadmin_org_stats_with_engagement() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_organization() CASCADE;
DROP FUNCTION IF EXISTS public.has_org_role(uuid, uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.remove_organization_member(uuid, uuid) CASCADE;

-- 3. Drop des colonnes organization_id (les FK partent avec la colonne)
ALTER TABLE public.companies          DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.audit_logs         DROP COLUMN IF EXISTS organization_id CASCADE;
ALTER TABLE public.user_activity_logs DROP COLUMN IF EXISTS organization_id CASCADE;

-- 4. Drop des tables mortes
DROP TABLE IF EXISTS public.subscription_usage        CASCADE;
DROP TABLE IF EXISTS public.organization_invitations  CASCADE;
DROP TABLE IF EXISTS public.organization_members_safe CASCADE;
DROP TABLE IF EXISTS public.organization_members      CASCADE;
DROP TABLE IF EXISTS public.organizations             CASCADE;
DROP TABLE IF EXISTS public.forecasts                 CASCADE;
DROP TABLE IF EXISTS public.bank_balance_snapshots    CASCADE;

-- 5. Repose des policies "propres" sur audit_logs et user_activity_logs (user-scoped)
CREATE POLICY "Users manage own audit logs"
  ON public.audit_logs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own activity"
  ON public.user_activity_logs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
