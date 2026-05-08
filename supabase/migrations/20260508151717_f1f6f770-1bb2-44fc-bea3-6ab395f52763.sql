-- Support du premier exercice fiscal long (jusqu'à 24 mois) dans le BP
ALTER TABLE public.bp_settings
  ADD COLUMN IF NOT EXISTS first_fiscal_year_end_date date;

COMMENT ON COLUMN public.bp_settings.first_fiscal_year_end_date IS
  'Date de clôture du premier exercice fiscal. Si NULL, fallback = clôture calendaire 12 mois après bp_start_date. Permet le premier exercice long (max 24 mois, légal en France pour création).';

-- Validation : Y1 doit être entre 1 et 24 mois après bp_start_date
CREATE OR REPLACE FUNCTION public.validate_bp_first_fiscal_year_end()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.first_fiscal_year_end_date IS NOT NULL AND NEW.bp_start_date IS NOT NULL THEN
    IF NEW.first_fiscal_year_end_date <= NEW.bp_start_date THEN
      RAISE EXCEPTION 'first_fiscal_year_end_date doit être postérieur à bp_start_date';
    END IF;
    IF NEW.first_fiscal_year_end_date > (NEW.bp_start_date + INTERVAL '24 months') THEN
      RAISE EXCEPTION 'Le premier exercice fiscal ne peut pas dépasser 24 mois (limite légale France)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_bp_first_fiscal_year_end ON public.bp_settings;
CREATE TRIGGER trg_validate_bp_first_fiscal_year_end
BEFORE INSERT OR UPDATE ON public.bp_settings
FOR EACH ROW
EXECUTE FUNCTION public.validate_bp_first_fiscal_year_end();