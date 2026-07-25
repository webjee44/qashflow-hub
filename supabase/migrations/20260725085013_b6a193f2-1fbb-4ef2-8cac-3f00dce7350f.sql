-- Backfill bridge_account_id on split children from their parent transaction.
-- Root cause: split children were created without bridge_account_id, so the
-- backward-walk anchor (which filters by active bridge_account_ids) excluded
-- them while the treasury actuals kept them, breaking opening balances.
UPDATE public.transactions c
SET bridge_account_id = p.bridge_account_id
FROM public.transactions p
WHERE c.parent_transaction_id = p.id
  AND c.source = 'split'
  AND c.bridge_account_id IS NULL
  AND p.bridge_account_id IS NOT NULL;