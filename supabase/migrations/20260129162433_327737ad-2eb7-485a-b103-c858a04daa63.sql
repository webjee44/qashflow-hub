
-- Mettre à jour la RLS policy de transactions pour utiliser has_company_access
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;

CREATE POLICY "Users can view accessible transactions"
ON public.transactions
FOR SELECT
USING (
  (auth.uid() = user_id) 
  OR 
  ((company_id IS NOT NULL) AND has_company_access(auth.uid(), company_id))
);

-- Mettre à jour aussi les autres policies pour cohérence (UPDATE/DELETE restent owner-only pour sécurité)
