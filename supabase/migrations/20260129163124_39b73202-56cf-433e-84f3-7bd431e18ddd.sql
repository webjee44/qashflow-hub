-- Corriger la RLS policy sur companies pour éviter la récursion
-- La fonction has_company_access fait référence à companies, donc on ne peut pas l'utiliser dans la RLS de companies

DROP POLICY IF EXISTS "Users can view accessible companies" ON public.companies;

-- Nouvelle policy sans récursion
CREATE POLICY "Users can view accessible companies"
ON public.companies
FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    -- Propriétaire de la société
    (auth.uid() = user_id)
    OR
    -- Membre explicite de la société
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = companies.id AND cm.user_id = auth.uid()
    )
    OR
    -- Admin/Owner de l'organisation
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = companies.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
);