
-- Refine identity: drop bridge_user_uuid from fallback so that reconnections
-- of the same card (same name + type) are detected as the same physical account.
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
    'fallback:' || coalesce(lower(p_name), '') || ':' || coalesce(lower(p_account_type), '')
  );
$$;

-- Refresh identities
UPDATE public.bridge_accounts
SET account_identity = public.compute_bridge_account_identity(iban, bridge_user_uuid, name, account_type);

-- Re-run dedup
WITH ranked AS (
  SELECT
    cba.id AS link_id,
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

-- Recompute stats for impacted companies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT company_id FROM public.company_bridge_accounts LOOP
    BEGIN
      PERFORM public.recompute_company_bank_stats(r.company_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
