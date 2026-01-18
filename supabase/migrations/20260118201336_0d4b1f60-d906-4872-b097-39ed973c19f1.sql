-- Update the CHECK constraint to include 'variable' which is used by the code
ALTER TABLE bp_revenue_streams 
DROP CONSTRAINT IF EXISTS bp_revenue_streams_model_check;

ALTER TABLE bp_revenue_streams 
ADD CONSTRAINT bp_revenue_streams_model_check 
CHECK (model IN ('variable', 'subscription', 'fixed', 'units', 'growth', 'unit_sales', 'project'));