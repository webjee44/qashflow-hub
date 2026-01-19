-- Add optional PCG subcategory field to fixed expenses
ALTER TABLE bp_fixed_expenses 
ADD COLUMN IF NOT EXISTS pcg_subcategory TEXT DEFAULT NULL;

COMMENT ON COLUMN bp_fixed_expenses.pcg_subcategory IS 'Code PCG optionnel (ex: 60611 pour Électricité)';