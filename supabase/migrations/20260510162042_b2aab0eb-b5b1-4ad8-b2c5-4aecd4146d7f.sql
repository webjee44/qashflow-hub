ALTER TABLE public.bp_revenue_streams
  ADD COLUMN IF NOT EXISTS is_one_shot boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bp_revenue_streams.is_one_shot IS
  'When true, the stream is treated as a non-recurring (one-shot) revenue: years > 1 receive 0, growth rates are ignored.';