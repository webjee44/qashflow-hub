ALTER TABLE public.bp_revenue_streams
  ADD COLUMN IF NOT EXISTS purchase_price_year2 numeric NULL,
  ADD COLUMN IF NOT EXISTS purchase_price_year3 numeric NULL,
  ADD COLUMN IF NOT EXISTS purchase_price_year4 numeric NULL;

COMMENT ON COLUMN public.bp_revenue_streams.purchase_price_year2 IS
  'Year 2 cost-of-goods % override. Null = inherit purchase_price (Year 1).';
COMMENT ON COLUMN public.bp_revenue_streams.purchase_price_year3 IS
  'Year 3 cost-of-goods % override. Null = inherit purchase_price (Year 1).';
COMMENT ON COLUMN public.bp_revenue_streams.purchase_price_year4 IS
  'Year 4 cost-of-goods % override. Null = inherit purchase_price (Year 1).';