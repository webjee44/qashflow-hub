
DROP FUNCTION IF EXISTS public.get_superadmin_crm_pipeline();

CREATE OR REPLACE FUNCTION public.get_superadmin_crm_pipeline()
 RETURNS TABLE(user_id uuid, email text, full_name text, created_at timestamp with time zone, onboarding_completed boolean, has_bank boolean, has_categorized boolean, total_time_seconds bigint, total_logins bigint, has_automation boolean, pipeline_stage text, last_active_at timestamp with time zone, subscription_status text, trial_ends_at timestamp with time zone, org_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY
  WITH user_data AS (
    SELECT
      u.id, u.email::text, p.full_name, u.created_at,
      COALESCE(p.onboarding_completed, false) as onboarding_done,
      EXISTS(SELECT 1 FROM bridge_accounts ba JOIN companies c
        ON c.bridge_user_uuid = ba.bridge_user_uuid
        WHERE c.user_id = u.id AND c.deleted_at IS NULL) as has_bank,
      EXISTS(SELECT 1 FROM transactions t
        WHERE t.user_id = u.id AND t.category_id IS NOT NULL) as has_cat,
      COALESCE((SELECT SUM(ual.duration_seconds) FROM user_activity_logs ual
        WHERE ual.user_id = u.id AND ual.event_type = 'heartbeat'), 0)::bigint as time_s,
      COALESCE((SELECT COUNT(*) FROM user_activity_logs ual
        WHERE ual.user_id = u.id AND ual.event_type = 'login'), 0)::bigint as logins,
      EXISTS(SELECT 1 FROM automation_rules ar WHERE ar.user_id = u.id) as has_auto,
      (SELECT MAX(ual.created_at) FROM user_activity_logs ual WHERE ual.user_id = u.id) as last_active,
      o.subscription_status as sub_status,
      o.trial_ends_at as trial_end,
      o.name as o_name
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    LEFT JOIN organization_members om ON om.user_id = u.id
    LEFT JOIN organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
  )
  SELECT ud.id, ud.email, ud.full_name, ud.created_at,
    ud.onboarding_done, ud.has_bank, ud.has_cat,
    ud.time_s, ud.logins, ud.has_auto,
    CASE
      WHEN ud.time_s > 18000 AND ud.logins > 10 AND ud.has_auto THEN 'power_user'
      WHEN ud.time_s > 3600 THEN 'active_1h'
      WHEN ud.has_cat THEN 'first_categorization'
      WHEN ud.has_bank THEN 'bank_connected'
      WHEN ud.onboarding_done THEN 'onboarding_complete'
      ELSE 'signed_up'
    END as pipeline_stage,
    ud.last_active as last_active_at,
    ud.sub_status::text as subscription_status,
    ud.trial_end as trial_ends_at,
    ud.o_name::text as org_name
  FROM user_data ud
  ORDER BY ud.created_at DESC;
END;
$function$;
