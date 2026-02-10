-- Ajouter le champ pcg_subcategory aux charges variables
ALTER TABLE bp_variable_expenses ADD COLUMN IF NOT EXISTS pcg_subcategory text;