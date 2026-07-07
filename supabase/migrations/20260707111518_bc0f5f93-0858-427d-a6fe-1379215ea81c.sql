BEGIN;

-- Rebuild the core company access primitive without any dependency on organizations.
CREATE OR REPLACE FUNCTION public.has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND c.deleted_at IS NULL
      AND c.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.company_members cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = _company_id
      AND cm.user_id = _user_id
      AND c.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.company_members my_membership
    JOIN public.companies requested_company ON requested_company.id = _company_id
    JOIN public.companies member_company ON member_company.id = my_membership.company_id
    WHERE my_membership.user_id = _user_id
      AND requested_company.deleted_at IS NULL
      AND member_company.deleted_at IS NULL
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_company_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_company_access(uuid, uuid) TO service_role;

-- Companies: remove organization-era policies and replace with team-of-trust access.
DROP POLICY IF EXISTS "Users can view accessible companies" ON public.companies;
DROP POLICY IF EXISTS "Users can update their own companies" ON public.companies;
DROP POLICY IF EXISTS "Users can delete their own companies" ON public.companies;

CREATE POLICY "Team members can view trusted companies"
ON public.companies
FOR SELECT
TO authenticated
USING (public.has_company_access(auth.uid(), id));

CREATE POLICY "Team members can update trusted companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (public.has_company_access(auth.uid(), id))
WITH CHECK (public.has_company_access(auth.uid(), id));

CREATE POLICY "Team members can soft delete trusted companies"
ON public.companies
FOR DELETE
TO authenticated
USING (public.has_company_access(auth.uid(), id));

-- Company members: remove organization-era admin checks and keep management in the company scope.
DROP POLICY IF EXISTS "Add company members" ON public.company_members;
DROP POLICY IF EXISTS "Remove company members" ON public.company_members;
DROP POLICY IF EXISTS "View company members" ON public.company_members;

CREATE POLICY "Team members can view company members"
ON public.company_members
FOR SELECT
TO authenticated
USING (public.has_company_access(auth.uid(), company_id) OR is_superadmin(auth.uid()));

CREATE POLICY "Team members can add company members"
ON public.company_members
FOR INSERT
TO authenticated
WITH CHECK (public.has_company_access(auth.uid(), company_id) OR is_superadmin(auth.uid()));

CREATE POLICY "Team members can remove company members"
ON public.company_members
FOR DELETE
TO authenticated
USING (public.has_company_access(auth.uid(), company_id) OR is_superadmin(auth.uid()));

-- Bridge account blocks: remove organization-era access fragments from write policies.
DROP POLICY IF EXISTS "bab_insert_owner_or_admin" ON public.bridge_account_blocks;
DROP POLICY IF EXISTS "bab_update_owner_or_admin" ON public.bridge_account_blocks;

CREATE POLICY "bab_insert_team_member"
ON public.bridge_account_blocks
FOR INSERT
TO authenticated
WITH CHECK (public.has_company_access(auth.uid(), company_id) OR is_superadmin(auth.uid()));

CREATE POLICY "bab_update_team_member"
ON public.bridge_account_blocks
FOR UPDATE
TO authenticated
USING (public.has_company_access(auth.uid(), company_id) OR is_superadmin(auth.uid()))
WITH CHECK (public.has_company_access(auth.uid(), company_id) OR is_superadmin(auth.uid()));

COMMIT;