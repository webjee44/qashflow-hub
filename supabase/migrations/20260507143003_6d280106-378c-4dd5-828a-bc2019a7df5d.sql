CREATE OR REPLACE FUNCTION public.reintegrate_company_bridge_account(
  p_company_id uuid,
  p_bridge_account_id integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_identity text;
BEGIN
  IF NOT (
    public.has_company_access(auth.uid(), p_company_id)
    OR public.is_superadmin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT ba.account_identity
  INTO v_account_identity
  FROM public.bridge_accounts ba
  WHERE ba.bridge_account_id = p_bridge_account_id
  LIMIT 1;

  IF v_account_identity IS NOT NULL THEN
    DELETE FROM public.company_bridge_account_identity_exclusions
    WHERE company_id = p_company_id
      AND account_identity = v_account_identity;
  END IF;

  UPDATE public.company_bridge_accounts
  SET
    status = 'active',
    excluded_at = NULL,
    excluded_by = NULL,
    exclusion_reason = NULL
  WHERE company_id = p_company_id
    AND bridge_account_id = p_bridge_account_id;

  PERFORM public.recompute_company_bank_stats(p_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.reintegrate_company_bridge_account(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reintegrate_company_bridge_account(uuid, integer) TO authenticated;