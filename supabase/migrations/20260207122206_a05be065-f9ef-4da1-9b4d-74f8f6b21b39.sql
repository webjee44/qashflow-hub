
-- Add forecast mode columns to categories table
ALTER TABLE public.categories 
ADD COLUMN forecast_mode text NOT NULL DEFAULT 'manual',
ADD COLUMN forecast_percent numeric NOT NULL DEFAULT 0;

-- Add a check constraint for valid forecast_mode values
-- Using a validation trigger instead of CHECK constraint for flexibility
CREATE OR REPLACE FUNCTION public.validate_category_forecast_mode()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.forecast_mode NOT IN ('manual', 'percent_of_revenue') THEN
    RAISE EXCEPTION 'Invalid forecast_mode: %. Must be manual or percent_of_revenue', NEW.forecast_mode;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_category_forecast_mode_trigger
BEFORE INSERT OR UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.validate_category_forecast_mode();
