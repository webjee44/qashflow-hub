-- Add bridge_user_uuid column to companies table to store the Bridge user association
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS bridge_user_uuid TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.companies.bridge_user_uuid IS 'UUID of the Bridge API user for bank aggregation';