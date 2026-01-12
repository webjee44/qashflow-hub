-- Add VAT rate column to categories table
ALTER TABLE public.categories 
ADD COLUMN vat_rate numeric NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.categories.vat_rate IS 'VAT rate as decimal (e.g., 0.20 for 20%)';