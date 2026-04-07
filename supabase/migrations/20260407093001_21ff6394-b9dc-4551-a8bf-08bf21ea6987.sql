
DROP FUNCTION IF EXISTS public.get_superadmin_org_stats_with_engagement();

CREATE FUNCTION public.get_superadmin_org_stats_with_engagement()
 RETURNS TABLE(organization_id uuid, name text, slug text, plan text, subscription_status text, owner_id uuid, owner_email text, created_at timestamp with time zone, max_members integer, max_companies integer, member_count bigint, company_count bigint, bp_count bigint, is_demo boolean, total_logins bigint, total_time_seconds bigint, last_active_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;

  RETURN QUERY
  SELECT
    o.id as organization_id,
    o.name,
    o.slug,
    o.plan,
    o.subscription_status,
    o.owner_id,
    (SELECT u.email FROM auth.users u WHERE u.id = o.owner_id)::text as owner_email,
    o.created_at,
    o.max_members,
    o.max_companies,
    (SELECT COUNT(*) FROM public.organization_members om WHERE om.organization_id = o.id) as member_count,
    (SELECT COUNT(*) FROM public.companies c WHERE c.organization_id = o.id AND c.deleted_at IS NULL) as company_count,
    (SELECT COUNT(*) FROM public.business_plans bp
     WHERE bp.company_id IN (SELECT comp.id FROM public.companies comp WHERE comp.organization_id = o.id)
    ) as bp_count,
    o.is_demo,
    COALESCE((
      SELECT COUNT(DISTINCT ual.id)
      FROM public.user_activity_logs ual
      WHERE ual.user_id IN (SELECT om.user_id FROM public.organization_members om WHERE om.organization_id = o.id)
        AND ual.event_type = 'login'
    ), 0) as total_logins,
    COALESCE((
      SELECT SUM(ual.duration_seconds)
      FROM public.user_activity_logs ual
      WHERE ual.user_id IN (SELECT om.user_id FROM public.organization_members om WHERE om.organization_id = o.id)
        AND ual.event_type = 'heartbeat'
    ), 0)::bigint as total_time_seconds,
    (
      SELECT MAX(ual.created_at)
      FROM public.user_activity_logs ual
      WHERE ual.user_id IN (SELECT om.user_id FROM public.organization_members om WHERE om.organization_id = o.id)
    ) as last_active_at
  FROM public.organizations o
  WHERE o.deleted_at IS NULL
  ORDER BY o.created_at DESC;
END;
$function$;
