
-- Add is_ignored column to transactions table
ALTER TABLE public.transactions ADD COLUMN is_ignored boolean NOT NULL DEFAULT false;

-- Add index for filtering ignored transactions
CREATE INDEX idx_transactions_is_ignored ON public.transactions (is_ignored) WHERE is_ignored = true;
