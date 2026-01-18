
-- Mettre bp_enabled à true par défaut pour tous les nouveaux profils
ALTER TABLE public.profiles ALTER COLUMN bp_enabled SET DEFAULT true;

-- Mettre à jour les profils existants qui ont bp_enabled = false ou NULL
UPDATE public.profiles SET bp_enabled = true WHERE bp_enabled IS NULL OR bp_enabled = false;
