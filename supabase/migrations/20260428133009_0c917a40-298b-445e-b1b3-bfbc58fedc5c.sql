
DROP POLICY IF EXISTS "Users can view accessible bridge accounts" ON public.bridge_accounts;
DROP POLICY IF EXISTS "Users can insert accessible bridge accounts" ON public.bridge_accounts;
DROP POLICY IF EXISTS "Users can update accessible bridge accounts" ON public.bridge_accounts;
DROP POLICY IF EXISTS "Users can delete accessible bridge accounts" ON public.bridge_accounts;

CREATE POLICY "Users can view accessible bridge accounts"
ON public.bridge_accounts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_bridge_accounts cba
    WHERE cba.bridge_account_id = bridge_accounts.bridge_account_id
      AND public.has_company_access(auth.uid(), cba.company_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
      AND c.deleted_at IS NULL
      AND public.has_company_access(auth.uid(), c.id)
  )
);

CREATE POLICY "Users can insert accessible bridge accounts"
ON public.bridge_accounts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
      AND c.deleted_at IS NULL
      AND public.has_company_access(auth.uid(), c.id)
  )
);

CREATE POLICY "Users can update accessible bridge accounts"
ON public.bridge_accounts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_bridge_accounts cba
    WHERE cba.bridge_account_id = bridge_accounts.bridge_account_id
      AND public.has_company_access(auth.uid(), cba.company_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
      AND c.deleted_at IS NULL
      AND public.has_company_access(auth.uid(), c.id)
  )
);

CREATE POLICY "Users can delete accessible bridge accounts"
ON public.bridge_accounts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_bridge_accounts cba
    WHERE cba.bridge_account_id = bridge_accounts.bridge_account_id
      AND public.has_company_access(auth.uid(), cba.company_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.bridge_user_uuid = bridge_accounts.bridge_user_uuid
      AND c.deleted_at IS NULL
      AND public.has_company_access(auth.uid(), c.id)
  )
);
