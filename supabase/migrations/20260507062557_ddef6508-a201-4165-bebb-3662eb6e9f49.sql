ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS merchant_key text,
  ADD COLUMN IF NOT EXISTS normalized_description text;

CREATE INDEX IF NOT EXISTS idx_transactions_company_merchant_key
  ON public.transactions (company_id, merchant_key)
  WHERE merchant_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_company_normalized_desc
  ON public.transactions (company_id, normalized_description)
  WHERE normalized_description IS NOT NULL AND deleted_at IS NULL;