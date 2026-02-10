
-- Drop the old restrictive update policy
DROP POLICY "Users can update their own companies" ON public.companies;

-- Create a new update policy that allows org owners/admins to update companies too
CREATE POLICY "Users can update their own companies"
ON public.companies
FOR UPDATE
USING (
  (auth.uid() = user_id)
  OR EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = companies.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);

-- Also fix delete policy for org owners/admins
DROP POLICY "Users can delete their own companies" ON public.companies;

CREATE POLICY "Users can delete their own companies"
ON public.companies
FOR DELETE
USING (
  (auth.uid() = user_id)
  OR EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.organization_id = companies.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
  )
);
