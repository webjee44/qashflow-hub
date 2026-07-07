-- IC-2b: add tx_date to intercompany_links (date de la transaction sortie, source de vérité pour l'aggrégation période)
ALTER TABLE public.intercompany_links
  ADD COLUMN IF NOT EXISTS tx_date date;

-- Backfill depuis transactions via tx_out_id
UPDATE public.intercompany_links l
SET tx_date = t.date
FROM public.transactions t
WHERE l.tx_out_id = t.id
  AND l.tx_date IS NULL;

-- Verrouiller NOT NULL (après backfill)
ALTER TABLE public.intercompany_links
  ALTER COLUMN tx_date SET NOT NULL;

-- Index pour les filtres de période
CREATE INDEX IF NOT EXISTS idx_intercompany_links_tx_date
  ON public.intercompany_links (tx_date DESC);
