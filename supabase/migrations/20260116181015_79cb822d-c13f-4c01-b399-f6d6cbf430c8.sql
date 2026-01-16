-- Drop the problematic views
DROP VIEW IF EXISTS public.v_superadmin_global_stats;
DROP VIEW IF EXISTS public.v_superadmin_org_stats;

-- Create a secure function to get global stats (only for superadmins)
CREATE OR REPLACE FUNCTION public.get_superadmin_global_stats()
RETURNS TABLE (
  total_users bigint,
  total_organizations bigint,
  total_companies bigint,
  total_business_plans bigint,
  total_transactions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is superadmin
  IF NOT is_superadmin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: superadmin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM auth.users)::bigint as total_users,
    (SELECT COUNT(*) FROM public.organizations WHERE deleted_at IS NULL)::bigint as total_organizations,
    (SELECT COUNT(*) FROM public.companies WHERE deleted_at IS NULL)::bigint as total_companies,
    (SELECT COUNT(*) FROM public.business_plans)::bigint as total_business_plans,
    (SELECT COUNT(*) FROM public.transactions WHERE deleted_at IS NULL)::bigint as total_transactions;
END;
$$;

-- Create a secure function to get organization stats (only for superadmins)
CREATE OR REPLACE FUNCTION public.get_superadmin_org_stats()
RETURNS TABLE (
  organization_id uuid,
  name text,
  slug text,
  plan text,
  subscription_status text,
  owner_id uuid,
  created_at timestamptz,
  max_members integer,
  max_companies integer,
  member_count bigint,
  company_count bigint,
  bp_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    (SELECT COUNT(*) FROM public.business_plans bp WHERE bp.company_id IN (SELECT id FROM public.companies WHERE organization_id = o.id)) as bp_count
  FROM public.organizations o
  WHERE o.deleted_at IS NULL
  ORDER BY o.created_at DESC;
END;
$$;