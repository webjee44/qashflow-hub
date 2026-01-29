-- SECURITY FIX: Remove dangerous superadmin bypass from regular app
-- Superadmins should only access data through the dedicated /superadmin panel
-- NOT through the regular company selector in the main app

-- 1. Drop the dangerous policy that gives superadmins access to ALL companies
DROP POLICY IF EXISTS "Superadmins can view all companies" ON public.companies;

-- 2. Update the "Users can view accessible companies" policy to remove superadmin bypass
DROP POLICY IF EXISTS "Users can view accessible companies" ON public.companies;

-- 3. Recreate policy WITHOUT superadmin bypass for regular app
-- Superadmins use dedicated RPC functions in the /superadmin panel instead
CREATE POLICY "Users can view accessible companies"
ON public.companies
FOR SELECT
USING (public.has_company_access(auth.uid(), id));

-- Note: The superadmin panel uses SECURITY DEFINER functions like:
-- - get_superadmin_org_stats() 
-- - get_superadmin_global_stats()
-- These bypass RLS safely for administrative purposes only