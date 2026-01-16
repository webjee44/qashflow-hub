-- Drop existing views first
DROP VIEW IF EXISTS public.v_superadmin_global_stats;
DROP VIEW IF EXISTS public.v_superadmin_org_stats;

-- Create a function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'superadmin'
  )
$$;

-- Create view for global stats (superadmin only)
CREATE VIEW public.v_superadmin_global_stats AS
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM public.organizations WHERE deleted_at IS NULL) as total_organizations,
  (SELECT COUNT(*) FROM public.companies WHERE deleted_at IS NULL) as total_companies,
  (SELECT COUNT(*) FROM public.business_plans) as total_business_plans,
  (SELECT COUNT(*) FROM public.transactions WHERE deleted_at IS NULL) as total_transactions;

-- Create view for org stats (superadmin only)
CREATE VIEW public.v_superadmin_org_stats AS
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
WHERE o.deleted_at IS NULL;