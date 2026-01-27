-- Add bank_name column to bridge_accounts table
ALTER TABLE public.bridge_accounts 
ADD COLUMN IF NOT EXISTS bank_name text NULL;

-- Add bank_id column for reference
ALTER TABLE public.bridge_accounts 
ADD COLUMN IF NOT EXISTS bank_id integer NULL;