-- Change default value of bp_enabled to true for new users
ALTER TABLE public.profiles ALTER COLUMN bp_enabled SET DEFAULT true;