
WITH dups AS (
  SELECT t_dup.id AS dup_id, parent.id AS parent_id, t_dup.bridge_transaction_id, t_dup.pennylane_id
  FROM transactions t_dup
  JOIN transactions parent
    ON parent.deleted_at IS NOT NULL
   AND parent.company_id = t_dup.company_id
   AND parent.date = t_dup.date
   AND parent.amount = t_dup.amount
   AND parent.description = t_dup.description
   AND parent.id <> t_dup.id
  WHERE t_dup.deleted_at IS NULL
    AND t_dup.bridge_transaction_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM transactions child
      WHERE child.parent_transaction_id = parent.id
        AND child.deleted_at IS NULL
    )
),
-- Transfer bridge_transaction_id to the soft-deleted parent first (avoid unique conflict)
clear_parent AS (
  UPDATE transactions p
  SET bridge_transaction_id = NULL, pennylane_id = NULL
  WHERE p.id IN (SELECT parent_id FROM dups)
  RETURNING p.id
),
clear_dup AS (
  UPDATE transactions d
  SET bridge_transaction_id = NULL, pennylane_id = NULL
  WHERE d.id IN (SELECT dup_id FROM dups)
  RETURNING d.id
),
restore_parent AS (
  UPDATE transactions p
  SET bridge_transaction_id = dups.bridge_transaction_id,
      pennylane_id = dups.pennylane_id,
      updated_at = now()
  FROM dups
  WHERE p.id = dups.parent_id
  RETURNING p.id
)
UPDATE transactions
SET deleted_at = now()
WHERE id IN (SELECT dup_id FROM dups);
