-- Add subscription model fields to bp_revenue_streams
ALTER TABLE bp_revenue_streams 
ADD COLUMN IF NOT EXISTS initial_subscribers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS churn_rate NUMERIC DEFAULT 0.05,
ADD COLUMN IF NOT EXISTS growth_rate NUMERIC DEFAULT 0.10;