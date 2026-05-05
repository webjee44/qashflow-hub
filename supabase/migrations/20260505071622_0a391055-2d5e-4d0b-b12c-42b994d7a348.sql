
-- Trigger function: cleanup orphan transactions when a bank account is unassigned from a company.
-- Source of truth = company_bridge_accounts. When a row is deleted, any transaction in the same
-- company tied to that bridge account (matched via bridge_accounts.name → transactions.bank_account_name)
-- must be removed to keep balances and totals consistent.
CREATE OR REPLACE FUNCTION public.cleanup_orphan_transactions_on_unassign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_name TEXT;
BEGIN
  SELECT name INTO v_account_name
  FROM bridge_accounts
  WHERE bridge_account_id = OLD.bridge_account_id
  LIMIT 1;

  IF v_account_name IS NULL THEN
    RETURN OLD;
  END IF;

  -- Only delete if the same (company_id, account name) pair is no longer assigned
  -- (defensive: a user could in theory have two assignments resolving to the same name).
  IF NOT EXISTS (
    SELECT 1
    FROM company_bridge_accounts cba
    JOIN bridge_accounts ba ON ba.bridge_account_id = cba.bridge_account_id
    WHERE cba.company_id = OLD.company_id
      AND ba.name = v_account_name
  ) THEN
    DELETE FROM transactions
    WHERE company_id = OLD.company_id
      AND bank_account_name = v_account_name;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_orphan_transactions_on_unassign ON public.company_bridge_accounts;

CREATE TRIGGER trg_cleanup_orphan_transactions_on_unassign
AFTER DELETE ON public.company_bridge_accounts
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_orphan_transactions_on_unassign();
