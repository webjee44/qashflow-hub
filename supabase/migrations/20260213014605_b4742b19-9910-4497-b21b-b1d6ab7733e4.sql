
-- ============================================
-- 1. Nettoyage des doublons intra-company
-- Garder la plus ancienne règle de chaque groupe de doublons
-- ============================================

-- Supprimer les doublons intra-company (garder le plus ancien id par groupe)
DELETE FROM automation_rules
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
      ROW_NUMBER() OVER (
        PARTITION BY company_id, condition_value, condition_operator, target_category_id 
        ORDER BY created_at ASC
      ) as rn
    FROM automation_rules
    WHERE is_active = true
  ) ranked
  WHERE rn > 1
);

-- ============================================
-- 2. Nettoyage des doublons cross-company
-- Supprimer la règle "FUMEUR VANNES" dupliquée sur company 12ea5853
-- (la version légitime est sur c6ce7d8e)
-- ============================================

DELETE FROM automation_rules 
WHERE id = 'c685b7ed-5a71-4740-a40a-76e2b1cf4ed3';

-- ============================================
-- 3. Contrainte d'unicité conditionnelle
-- Empêche les doublons futurs pour les règles actives
-- ============================================

CREATE UNIQUE INDEX idx_unique_active_automation_rule 
ON automation_rules(company_id, condition_value, condition_operator, target_category_id) 
WHERE is_active = true;
