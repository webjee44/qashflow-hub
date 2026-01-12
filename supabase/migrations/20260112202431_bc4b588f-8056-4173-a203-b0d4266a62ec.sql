-- Add bank_balance column to companies table to store the real bank balance from Pennylane
ALTER TABLE public.companies 
ADD COLUMN bank_balance numeric DEFAULT NULL,
ADD COLUMN bank_balance_updated_at timestamp with time zone DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.companies.bank_balance IS 'Current bank balance fetched from Pennylane trial balance (accounts 512xxx)';
COMMENT ON COLUMN public.companies.bank_balance_updated_at IS 'Last time the bank balance was synced from Pennylane';