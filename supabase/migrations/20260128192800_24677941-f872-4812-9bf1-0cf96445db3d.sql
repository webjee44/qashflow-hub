-- Ajouter le nom du salarié/prestataire à bp_personnel
ALTER TABLE public.bp_personnel 
ADD COLUMN name text DEFAULT NULL;