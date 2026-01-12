-- Add bank account column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN bank_account_name TEXT;