-- Add year-specific growth rates (N+1, N+2, N+3, N+4)
-- Using JSONB to store growth rates per year as an array
ALTER TABLE public.bp_revenue_streams 
ADD COLUMN IF NOT EXISTS growth_rate_year2 DECIMAL DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS growth_rate_year3 DECIMAL DEFAULT 0.10,
ADD COLUMN IF NOT EXISTS growth_rate_year4 DECIMAL DEFAULT 0.10;

-- Migrate existing annual_growth_rate to year2 (most common case)
UPDATE public.bp_revenue_streams 
SET growth_rate_year2 = COALESCE(annual_growth_rate, 0.10),
    growth_rate_year3 = COALESCE(annual_growth_rate, 0.10),
    growth_rate_year4 = COALESCE(annual_growth_rate, 0.10);

-- Add comments for clarity
COMMENT ON COLUMN public.bp_revenue_streams.growth_rate_year2 IS 'Taux de croissance pour l''année 2 vs année 1';
COMMENT ON COLUMN public.bp_revenue_streams.growth_rate_year3 IS 'Taux de croissance pour l''année 3 vs année 2';
COMMENT ON COLUMN public.bp_revenue_streams.growth_rate_year4 IS 'Taux de croissance pour l''année 4 vs année 3';