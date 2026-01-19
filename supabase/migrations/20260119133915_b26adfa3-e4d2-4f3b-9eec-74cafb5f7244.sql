-- Ajouter un champ pour identifier les charges qui impactent la marge brute (Coût des ventes)
ALTER TABLE bp_variable_expenses 
ADD COLUMN IF NOT EXISTS is_cogs BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN bp_variable_expenses.is_cogs IS 'Si TRUE, cette charge est un coût des ventes (impacte la marge brute). Si FALSE, c est une charge d exploitation.';

-- Par défaut, seules les charges de catégorie "cogs" (achats marchandises) sont considérées comme COGS
-- Les autres catégories (commissions, marketing) sont des charges d'exploitation
UPDATE bp_variable_expenses 
SET is_cogs = CASE 
  WHEN category = 'cogs' THEN TRUE 
  ELSE FALSE 
END;