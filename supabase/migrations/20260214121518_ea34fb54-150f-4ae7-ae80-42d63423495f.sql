
-- Add is_demo column to BP tables for demo data identification
ALTER TABLE public.bp_revenue_streams ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.bp_revenue_forecasts ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.bp_fixed_expenses ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.bp_personnel ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
ALTER TABLE public.bp_investments ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false;
