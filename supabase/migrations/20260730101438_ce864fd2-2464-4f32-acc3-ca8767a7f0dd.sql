BEGIN;

ALTER TABLE public.bridge_accounts
  ADD COLUMN IF NOT EXISTS balance_last_refreshed_at timestamptz;

DROP VIEW IF EXISTS public.company_active_bridge_accounts;

CREATE VIEW public.company_active_bridge_accounts
WITH (security_invoker = on) AS
 SELECT cba.company_id,
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
    ba.item_status_message,
    ba.last_sync_at,
    ba.balance_last_refreshed_at,
    ba.updated_at
   FROM company_bridge_accounts cba
     JOIN bridge_accounts ba USING (bridge_account_id)
  WHERE cba.status = 'active'::text
    AND ba.lifecycle_status = 'active'::text
    AND NOT (EXISTS ( SELECT 1
           FROM bridge_account_blocks b
          WHERE b.company_id = cba.company_id
            AND b.is_active = true
            AND (b.bridge_account_id = cba.bridge_account_id OR b.account_identity = ba.account_identity)));

GRANT SELECT ON public.company_active_bridge_accounts TO authenticated;
GRANT ALL ON public.company_active_bridge_accounts TO service_role;

COMMIT;