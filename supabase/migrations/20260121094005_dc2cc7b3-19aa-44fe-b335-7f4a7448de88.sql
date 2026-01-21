-- Add purchase cost fields to revenue streams
ALTER TABLE bp_revenue_streams 
ADD COLUMN IF NOT EXISTS purchase_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_purchase_cost boolean DEFAULT false;

-- Add constraint for gross_margin_type
COMMENT ON COLUMN bp_revenue_streams.purchase_price IS 'Unit purchase price HT for calculating COGS';
COMMENT ON COLUMN bp_revenue_streams.has_purchase_cost IS 'Whether this revenue stream has associated purchase costs';