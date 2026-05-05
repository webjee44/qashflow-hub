
ALTER TABLE public.company_bridge_accounts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS excluded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS excluded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exclusion_reason text NULL;

ALTER TABLE public.company_bridge_accounts
  DROP CONSTRAINT IF EXISTS company_bridge_accounts_status_check;
ALTER TABLE public.company_bridge_accounts
  ADD CONSTRAINT company_bridge_accounts_status_check
  CHECK (status IN ('active','excluded'));

CREATE INDEX IF NOT EXISTS idx_cba_company_status
  ON public.company_bridge_accounts(company_id, status);

ALTER TABLE public.bridge_accounts
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS replaced_by_bridge_account_id bigint NULL,
  ADD COLUMN IF NOT EXISTS duplicate_confidence numeric NULL,
  ADD COLUMN IF NOT EXISTS duplicate_reason text NULL;

ALTER TABLE public.bridge_accounts
  DROP CONSTRAINT IF EXISTS bridge_accounts_lifecycle_status_check;
ALTER TABLE public.bridge_accounts
  ADD CONSTRAINT bridge_accounts_lifecycle_status_check
  CHECK (lifecycle_status IN ('active','disabled','deleted','replaced'));

UPDATE public.bridge_accounts
SET lifecycle_status = CASE
  WHEN status = 'deleted' THEN 'deleted'
  WHEN status = 'replaced' THEN 'replaced'
  WHEN status = 'disabled' THEN 'disabled'
  WHEN is_ignored = true AND status = 'replaced' THEN 'replaced'
  ELSE 'active'
END
WHERE lifecycle_status = 'active';

CREATE INDEX IF NOT EXISTS idx_bridge_accounts_lifecycle
  ON public.bridge_accounts(lifecycle_status);

DROP VIEW IF EXISTS public.company_active_bridge_accounts;
CREATE VIEW public.company_active_bridge_accounts
WITH (security_invoker = true)
AS
SELECT
  cba.company_id,
  cba.bridge_account_id,
  cba.status AS assignment_status,
  cba.excluded_at,
  cba.exclusion_reason,
  ba.name,
  ba.iban,
  ba.balance,
  ba.account_type,
  ba.bridge_item_id,
  ba.bridge_user_uuid,
  ba.bank_name,
  ba.lifecycle_status,
  ba.item_status,
  ba.last_sync_at,
  ba.updated_at
FROM public.company_bridge_accounts cba
JOIN public.bridge_accounts ba USING (bridge_account_id)
WHERE cba.status = 'active'
  AND ba.lifecycle_status = 'active';

GRANT SELECT ON public.company_active_bridge_accounts TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.recompute_company_bank_stats(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.companies c
  SET
    bank_balance = COALESCE(stats.total_balance, 0),
    bridge_accounts_count = COALESCE(stats.total_count, 0),
    bank_balance_updated_at = now()
  FROM (
    SELECT
      v.company_id,
      SUM(v.balance)::numeric AS total_balance,
      COUNT(v.bridge_account_id)::integer AS total_count
    FROM public.company_active_bridge_accounts v
    WHERE v.company_id = p_company_id
    GROUP BY v.company_id
  ) AS stats
  WHERE c.id = p_company_id AND stats.company_id = c.id;

  IF NOT FOUND THEN
    UPDATE public.companies
    SET
      bank_balance = 0,
      bridge_accounts_count = 0,
      bank_balance_updated_at = now()
    WHERE id = p_company_id;
  END IF;
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_transactions_company_bridge_account
  ON public.transactions(company_id, bridge_account_id)
  WHERE deleted_at IS NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT company_id FROM public.company_bridge_accounts LOOP
    PERFORM public.recompute_company_bank_stats(r.company_id);
  END LOOP;
END $$;
