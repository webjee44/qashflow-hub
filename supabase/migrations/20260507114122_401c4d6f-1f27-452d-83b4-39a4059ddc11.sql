
-- 1. Trigger: empêche qu'un sync/upsert serveur réactive une exclusion utilisateur
CREATE OR REPLACE FUNCTION public.prevent_excluded_to_active_reactivation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'excluded'
     AND NEW.status = 'active'
     AND (NEW.exclusion_reason IS NOT NULL OR NEW.excluded_by IS NOT NULL OR NEW.excluded_at IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Cannot reactivate an excluded account without explicitly clearing exclusion fields (excluded_at, excluded_by, exclusion_reason). This protects user decisions from being overwritten by automated syncs.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_excluded_to_active_reactivation_trigger ON public.company_bridge_accounts;
CREATE TRIGGER prevent_excluded_to_active_reactivation_trigger
BEFORE UPDATE ON public.company_bridge_accounts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_excluded_to_active_reactivation();
