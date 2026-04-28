-- Normalize all category_forecasts to TTC basis (single source of truth)
-- The treasury grid is 100% TTC by convention (mem://features/treasury/cash-flow-standard).
-- Historical rows stored as 'ht' were displayed as if they were TTC values (because
-- toTtc only converts when basis='ht' AND vat_rate>0, and many were vat_rate=0 anyway).
-- We simply relabel them to 'ttc': no change to the user-visible amount, but the
-- % of revenue calculation will now correctly derive HT via the category's vat_rate.
UPDATE public.category_forecasts
SET amount_basis = 'ttc'
WHERE amount_basis = 'ht';