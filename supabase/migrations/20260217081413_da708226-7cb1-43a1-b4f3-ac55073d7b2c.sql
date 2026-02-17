
-- Fix: restore companies SELECT policy without circular RLS dependency
-- has_company_access queries companies table internally, causing infinite recursion
-- We must inline the access checks directly

DROP POLICY "Users can view accessible companies" ON public.companies;

CREATE POLICY "Users can view accessible companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL 
  AND (
    -- Owner of the company
    user_id = auth.uid()
    OR
    -- Explicit member via company_members
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = companies.id AND cm.user_id = auth.uid()
    )
    OR
    -- Admin/Owner of the organization
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = companies.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
);
