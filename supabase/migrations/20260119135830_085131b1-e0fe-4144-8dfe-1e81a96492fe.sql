-- ================================================
-- Ajout de la catégorie 'taxes' aux charges fixes
-- ================================================

-- Mise à jour de la contrainte CHECK pour inclure 'taxes'
ALTER TABLE bp_fixed_expenses DROP CONSTRAINT IF EXISTS bp_fixed_expenses_category_check;

ALTER TABLE bp_fixed_expenses
ADD CONSTRAINT bp_fixed_expenses_category_check 
CHECK (category IS NULL OR category IN ('rent','insurance','software','telecom','marketing','utilities','professional_fees','banking','travel','office','taxes','other'));