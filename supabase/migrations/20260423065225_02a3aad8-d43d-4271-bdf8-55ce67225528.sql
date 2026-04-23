-- Add amount_basis column to category_forecasts to track whether the stored
-- expected_amount is HT (hors taxes) or TTC (toutes taxes comprises).
-- Existing rows are preserved as 'ht' to keep current displays consistent.
-- New rows default to 'ttc' to align with standard cash-flow convention.

ALTER TABLE public.category_forecasts
  ADD COLUMN IF NOT EXISTS amount_basis text NOT NULL DEFAULT 'ttc';

-- Backfill: all pre-existing forecasts were stored in HT under the old convention
UPDATE public.category_forecasts
  SET amount_basis = 'ht'
  WHERE amount_basis = 'ttc'
    AND created_at < now();

-- Validation trigger (instead of CHECK constraint, per project rules)
CREATE OR REPLACE FUNCTION public.validate_category_forecasts_amount_basis()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.amount_basis NOT IN ('ht', 'ttc') THEN
    RAISE EXCEPTION 'amount_basis must be either ''ht'' or ''ttc'', got %', NEW.amount_basis;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_category_forecasts_amount_basis_trigger
  ON public.category_forecasts;

CREATE TRIGGER validate_category_forecasts_amount_basis_trigger
  BEFORE INSERT OR UPDATE ON public.category_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_category_forecasts_amount_basis();