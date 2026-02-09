
-- Add bridge_transaction_id column for deduplication
ALTER TABLE public.transactions 
ADD COLUMN bridge_transaction_id bigint;

-- Create unique index for deduplication (per company)
CREATE UNIQUE INDEX idx_transactions_bridge_id_company 
ON public.transactions (bridge_transaction_id, company_id) 
WHERE bridge_transaction_id IS NOT NULL AND deleted_at IS NULL;

-- Index for faster lookups
CREATE INDEX idx_transactions_bridge_id 
ON public.transactions (bridge_transaction_id) 
WHERE bridge_transaction_id IS NOT NULL;
