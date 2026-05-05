
-- 1. Add account_identity column on bridge_accounts
ALTER TABLE public.bridge_accounts
  ADD COLUMN IF NOT EXISTS account_identity TEXT;

-- 2. Function computing the business identity of a bridge account
CREATE OR REPLACE FUNCTION public.compute_bridge_account_identity(
  p_iban TEXT,
  p_bridge_user_uuid TEXT,
  p_name TEXT,
  p_account_type TEXT
) RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(regexp_replace(lower(coalesce(p_iban, '')), '\s+', '', 'g'), ''),
    'fallback:' || coalesce(p_bridge_user_uuid, '') || ':' || coalesce(lower(p_name), '') || ':' || coalesce(lower(p_account_type), '')
  );
$$;

-- 3. Trigger to keep account_identity fresh on bridge_accounts
CREATE OR REPLACE FUNCTION public.set_bridge_account_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.account_identity := public.compute_bridge_account_identity(
    NEW.iban, NEW.bridge_user_uuid, NEW.name, NEW.account_type
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_bridge_account_identity ON public.bridge_accounts;
CREATE TRIGGER trg_set_bridge_account_identity
  BEFORE INSERT OR UPDATE OF iban, name, account_type, bridge_user_uuid
  ON public.bridge_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_bridge_account_identity();

-- 4. Backfill existing rows
UPDATE public.bridge_accounts
SET account_identity = public.compute_bridge_account_identity(iban, bridge_user_uuid, name, account_type)
WHERE account_identity IS NULL;

CREATE INDEX IF NOT EXISTS idx_bridge_accounts_identity ON public.bridge_accounts(account_identity);

-- 5. Dedup company_bridge_accounts: per (company_id, identity), keep the row whose bridge_account
-- has the most recent last_sync_at.
WITH ranked AS (
  SELECT
    cba.id AS link_id,
    cba.company_id,
    ba.account_identity,
    ROW_NUMBER() OVER (
      PARTITION BY cba.company_id, ba.account_identity
      ORDER BY ba.last_sync_at DESC NULLS LAST, cba.created_at DESC
    ) AS rn
  FROM public.company_bridge_accounts cba
  JOIN public.bridge_accounts ba ON ba.bridge_account_id = cba.bridge_account_id
  WHERE ba.account_identity IS NOT NULL
)
DELETE FROM public.company_bridge_accounts
WHERE id IN (SELECT link_id FROM ranked WHERE rn > 1);

-- 6. Trigger on company_bridge_accounts: when inserting a link, if another link exists for
-- the same (company_id, account_identity), remove the old one (it points to a stale Bridge ref).
CREATE OR REPLACE FUNCTION public.enforce_company_bridge_account_unicity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_identity TEXT;
BEGIN
  SELECT account_identity INTO v_identity
  FROM public.bridge_accounts
  WHERE bridge_account_id = NEW.bridge_account_id
  LIMIT 1;

  IF v_identity IS NULL THEN
    RETURN NEW;
  END IF;

  -- Delete any other link to the same business identity for this company,
  -- except the row we're about to insert (matched on bridge_account_id).
  DELETE FROM public.company_bridge_accounts cba
  USING public.bridge_accounts ba
  WHERE cba.bridge_account_id = ba.bridge_account_id
    AND cba.company_id = NEW.company_id
    AND ba.account_identity = v_identity
    AND cba.bridge_account_id <> NEW.bridge_account_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_company_bridge_account_unicity ON public.company_bridge_accounts;
CREATE TRIGGER trg_enforce_company_bridge_account_unicity
  BEFORE INSERT ON public.company_bridge_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_company_bridge_account_unicity();

-- 7. Recompute bank stats for all impacted companies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT company_id FROM public.company_bridge_accounts LOOP
    BEGIN
      PERFORM public.recompute_company_bank_stats(r.company_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'recompute failed for %: %', r.company_id, SQLERRM;
    END;
  END LOOP;
END $$;
