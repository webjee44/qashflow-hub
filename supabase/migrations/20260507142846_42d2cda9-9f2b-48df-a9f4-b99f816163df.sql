CREATE OR REPLACE FUNCTION public.record_company_bridge_identity_exclusion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bridge_user_uuid text;
  v_account_identity text;
  v_account_type text;
BEGIN
  IF NEW.status <> 'excluded' THEN
    RETURN NEW;
  END IF;

  SELECT ba.bridge_user_uuid, ba.account_identity, ba.account_type
  INTO v_bridge_user_uuid, v_account_identity, v_account_type
  FROM public.bridge_accounts ba
  WHERE ba.bridge_account_id = NEW.bridge_account_id
  LIMIT 1;

  IF v_account_identity IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.company_bridge_account_identity_exclusions (
    company_id,
    bridge_user_uuid,
    account_identity,
    account_type,
    reason,
    excluded_by
  ) VALUES (
    NEW.company_id,
    v_bridge_user_uuid,
    v_account_identity,
    v_account_type,
    COALESCE(NEW.exclusion_reason, 'Compte exclu durablement'),
    NEW.excluded_by
  )
  ON CONFLICT (company_id, account_identity) DO UPDATE
  SET
    bridge_user_uuid = COALESCE(EXCLUDED.bridge_user_uuid, public.company_bridge_account_identity_exclusions.bridge_user_uuid),
    account_type = COALESCE(EXCLUDED.account_type, public.company_bridge_account_identity_exclusions.account_type),
    reason = COALESCE(EXCLUDED.reason, public.company_bridge_account_identity_exclusions.reason),
    excluded_by = COALESCE(EXCLUDED.excluded_by, public.company_bridge_account_identity_exclusions.excluded_by),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_company_bridge_identity_exclusion_trigger
ON public.company_bridge_accounts;
CREATE TRIGGER record_company_bridge_identity_exclusion_trigger
AFTER INSERT OR UPDATE OF status, exclusion_reason, excluded_by
ON public.company_bridge_accounts
FOR EACH ROW
WHEN (NEW.status = 'excluded')
EXECUTE FUNCTION public.record_company_bridge_identity_exclusion();