CREATE OR REPLACE FUNCTION public.enforce_company_bridge_account_unicity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  DELETE FROM public.company_bridge_accounts cba
  USING public.bridge_accounts ba
  WHERE cba.bridge_account_id = ba.bridge_account_id
    AND cba.company_id = NEW.company_id
    AND ba.account_identity = v_identity
    AND cba.bridge_account_id <> NEW.bridge_account_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_company_bridge_account_unicity() FROM PUBLIC, anon, authenticated;