CREATE POLICY "Users can update their company bridge accounts"
ON public.company_bridge_accounts
FOR UPDATE
TO authenticated
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));