-- Add annual growth rate column to bp_revenue_streams
ALTER TABLE public.bp_revenue_streams 
ADD COLUMN IF NOT EXISTS annual_growth_rate DECIMAL DEFAULT 0.10;

-- Add comment for documentation
COMMENT ON COLUMN public.bp_revenue_streams.annual_growth_rate IS 'Annual growth rate for years 2+ projections (e.g., 0.10 = 10%)';