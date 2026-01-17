-- Fix ambiguous column reference in get_superadmin_org_stats function
CREATE OR REPLACE FUNCTION public.get_superadmin_org_stats()
 RETURNS TABLE(organization_id uuid, name text, slug text, plan text, subscription_status text, owner_id uuid, created_at timestamp with time zone, max_members integer, max_companies integer, member_count bigint, company_count bigint, bp_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if user is superadmin
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
    o.created_at,
    o.max_members,
    o.max_companies,
    (SELECT COUNT(*) FROM public.organization_members om WHERE om.organization_id = o.id) as member_count,
    (SELECT COUNT(*) FROM public.companies c WHERE c.organization_id = o.id AND c.deleted_at IS NULL) as company_count,
    (SELECT COUNT(*) FROM public.business_plans bp 
     WHERE bp.company_id IN (SELECT comp.id FROM public.companies comp WHERE comp.organization_id = o.id)
    ) as bp_count
  FROM public.organizations o
  WHERE o.deleted_at IS NULL
  ORDER BY o.created_at DESC;
END;
$function$;