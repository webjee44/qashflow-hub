ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS bridge_account_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_transactions_bridge_account_id 
  ON public.transactions(bridge_account_id) 
  WHERE bridge_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_company_bridge_account 
  ON public.transactions(company_id, bridge_account_id) 
  WHERE deleted_at IS NULL;