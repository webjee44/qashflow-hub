REVOKE ALL ON FUNCTION public.enforce_company_bridge_identity_exclusion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_bridge_identity_exclusions_for_account() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_company_bridge_identity_exclusion() FROM PUBLIC, anon, authenticated;