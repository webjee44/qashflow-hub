-- Add source tracking to category_forecasts
ALTER TABLE public.category_forecasts 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS bp_stream_id uuid REFERENCES public.bp_revenue_streams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bp_expense_id uuid REFERENCES public.bp_fixed_expenses(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.category_forecasts.source IS 'Source of the forecast: manual, bp_import, bp_synced';