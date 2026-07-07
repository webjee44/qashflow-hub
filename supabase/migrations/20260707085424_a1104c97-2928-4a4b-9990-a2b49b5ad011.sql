-- 1. Normalize existing vat_regime values BEFORE swapping the CHECK constraint.
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_vat_regime_check;

UPDATE public.companies SET vat_regime = 'monthly'
  WHERE vat_regime IN ('monthly_real');
UPDATE public.companies SET vat_regime = 'quarterly'
  WHERE vat_regime IN ('quarterly_real', 'simplified');
UPDATE public.companies SET vat_regime = 'none'
  WHERE vat_regime IN ('franchise');
-- Any unknown legacy value falls back to the new default.
UPDATE public.companies SET vat_regime = 'monthly'
  WHERE vat_regime NOT IN ('monthly', 'quarterly', 'none');

-- 2. New default aligned with the simplified 3-value model.
ALTER TABLE public.companies ALTER COLUMN vat_regime SET DEFAULT 'monthly';

-- 3. Re-add the CHECK constraint restricted to the 3 supported values.
ALTER TABLE public.companies
  ADD CONSTRAINT companies_vat_regime_check
  CHECK (vat_regime IN ('monthly', 'quarterly', 'none'));

-- Note: categories.forecast_mode has no CHECK constraint (free text, default
-- 'manual'), so the new value 'auto_vat' is accepted without a schema change.
-- The engine treats forecast_mode='auto_vat' as the auto VAT payment mode.