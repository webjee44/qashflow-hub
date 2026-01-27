-- Add column to track number of connected bank accounts
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS bridge_accounts_count integer DEFAULT 0;