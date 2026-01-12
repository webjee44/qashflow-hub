-- Add initial_balance column to companies table
ALTER TABLE public.companies 
ADD COLUMN initial_balance numeric NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.companies.initial_balance IS 'Starting bank balance before any transactions are recorded';