-- 1. Ajouter 'professional_fees' à bp_fixed_expenses
ALTER TABLE bp_fixed_expenses 
DROP CONSTRAINT IF EXISTS bp_fixed_expenses_category_check;

ALTER TABLE bp_fixed_expenses 
ADD CONSTRAINT bp_fixed_expenses_category_check 
CHECK (category = ANY (ARRAY['rent', 'insurance', 'software', 'marketing', 'utilities', 'professional_fees', 'other']));

-- 2. Ajouter 'subscription' à bp_revenue_streams
ALTER TABLE bp_revenue_streams 
DROP CONSTRAINT IF EXISTS bp_revenue_streams_model_check;

ALTER TABLE bp_revenue_streams 
ADD CONSTRAINT bp_revenue_streams_model_check 
CHECK (model = ANY (ARRAY['fixed', 'units', 'growth', 'subscription']));