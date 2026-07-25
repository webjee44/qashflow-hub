
DROP POLICY IF EXISTS intercompany_match_runs_team_select ON public.intercompany_match_runs;
CREATE POLICY intercompany_match_runs_superadmin_select
  ON public.intercompany_match_runs
  FOR SELECT
  TO authenticated
  USING (public.is_superadmin(auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_category_forecast_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.forecast_mode NOT IN ('manual', 'percent_of_revenue', 'auto_vat') THEN
    RAISE EXCEPTION 'Invalid forecast_mode: %. Must be manual, percent_of_revenue or auto_vat', NEW.forecast_mode;
  END IF;
  RETURN NEW;
END;
$function$;
