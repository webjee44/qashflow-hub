
-- Fix companies SELECT policy to use SECURITY DEFINER function instead of nested subqueries
-- This avoids circular RLS evaluation between companies and company_members
DROP POLICY "Users can view accessible companies" ON public.companies;

CREATE POLICY "Users can view accessible companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL 
  AND has_company_access(auth.uid(), id)
);
