-- Fix default + backfill for variable expense gross margin classification
ALTER TABLE public.bp_variable_expenses
  ALTER COLUMN is_cogs SET DEFAULT false;

-- If the flag is missing or was previously defaulted to true, align it with category:
-- only category = 'cogs' impacts gross margin by default.
UPDATE public.bp_variable_expenses
SET is_cogs = (category = 'cogs')
WHERE is_cogs IS NULL
   OR (category <> 'cogs' AND is_cogs = true);
