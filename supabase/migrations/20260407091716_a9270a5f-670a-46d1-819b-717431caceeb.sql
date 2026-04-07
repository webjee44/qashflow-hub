DROP FUNCTION IF EXISTS public.get_superadmin_all_members();

CREATE FUNCTION public.get_superadmin_all_members()
 RETURNS TABLE(user_id uuid, email text, full_name text, phone text, first_name text, last_name text, job_title text, onboarding_completed boolean, created_at timestamp with time zone, organizations jsonb, companies jsonb, company_activity_type text, company_entity_count text, company_revenue_range text)
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
    u.id as user_id,
    u.email::text,
    p.full_name,
    p.phone,
    p.first_name,
    p.last_name,
    p.job_title,
    COALESCE(p.onboarding_completed, false) as onboarding_completed,
    u.created_at,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'org_id', o.id,
          'org_name', o.name,
          'role', om.role
        ) ORDER BY o.name
      )
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = u.id AND o.deleted_at IS NULL
    ), '[]'::jsonb) as organizations,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'company_id', sub.id,
          'company_name', sub.name,
          'access_type', sub.access_type
        ) ORDER BY sub.name
      )
      FROM (
        SELECT c.id, c.name, 'owner'::text as access_type
        FROM companies c 
        WHERE c.user_id = u.id AND c.deleted_at IS NULL
        UNION
        SELECT c.id, c.name, 'member'::text as access_type
        FROM company_members cm
        JOIN companies c ON c.id = cm.company_id
        WHERE cm.user_id = u.id AND c.deleted_at IS NULL AND c.user_id != u.id
      ) sub
    ), '[]'::jsonb) as companies,
    p.company_activity_type,
    p.company_entity_count,
    p.company_revenue_range
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$function$;