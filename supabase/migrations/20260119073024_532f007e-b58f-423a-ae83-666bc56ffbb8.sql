-- Phase 1: Fix orphaned data in bp_fixed_expenses
UPDATE bp_fixed_expenses 
SET company_id = (SELECT id FROM companies WHERE user_id = bp_fixed_expenses.user_id AND is_default = true LIMIT 1)
WHERE company_id IS NULL;

-- Phase 1: Fix orphaned data in bp_personnel
UPDATE bp_personnel 
SET company_id = (SELECT id FROM companies WHERE user_id = bp_personnel.user_id AND is_default = true LIMIT 1)
WHERE company_id IS NULL;

-- Phase 1: Fix orphaned data in bp_investments
UPDATE bp_investments 
SET company_id = (SELECT id FROM companies WHERE user_id = bp_investments.user_id AND is_default = true LIMIT 1)
WHERE company_id IS NULL;

-- Phase 1: Fix orphaned data in bp_financings
UPDATE bp_financings 
SET company_id = (SELECT id FROM companies WHERE user_id = bp_financings.user_id AND is_default = true LIMIT 1)
WHERE company_id IS NULL;

-- Phase 1: Fix orphaned data in bp_revenue_streams
UPDATE bp_revenue_streams 
SET company_id = (SELECT id FROM companies WHERE user_id = bp_revenue_streams.user_id AND is_default = true LIMIT 1)
WHERE company_id IS NULL;

-- Phase 2: Update CHECK constraint for bp_fixed_expenses categories
ALTER TABLE bp_fixed_expenses 
DROP CONSTRAINT IF EXISTS bp_fixed_expenses_category_check;

ALTER TABLE bp_fixed_expenses 
ADD CONSTRAINT bp_fixed_expenses_category_check 
CHECK (category IS NULL OR category IN ('rent', 'insurance', 'software', 'telecom', 'marketing', 'utilities', 'professional_fees', 'banking', 'travel', 'office', 'other', 'Locaux', 'Assurances', 'Services externes', 'Infrastructure', 'Outils'));