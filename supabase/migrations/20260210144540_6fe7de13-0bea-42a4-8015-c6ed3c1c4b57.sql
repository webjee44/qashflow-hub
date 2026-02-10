-- Ajouter 'services' (Prestation de service) à la contrainte CHECK des catégories de charges fixes
ALTER TABLE bp_fixed_expenses DROP CONSTRAINT IF EXISTS bp_fixed_expenses_category_check;

ALTER TABLE bp_fixed_expenses
ADD CONSTRAINT bp_fixed_expenses_category_check 
CHECK (category IS NULL OR category IN ('rent','insurance','software','telecom','marketing','utilities','professional_fees','banking','travel','office','taxes','services','other'));