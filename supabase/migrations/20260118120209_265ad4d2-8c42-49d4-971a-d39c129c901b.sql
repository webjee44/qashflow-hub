-- Add payment frequency to bp_fixed_expenses
ALTER TABLE public.bp_fixed_expenses 
ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly', 'quarterly', 'biannual', 'annual'));

ALTER TABLE public.bp_fixed_expenses 
ADD COLUMN IF NOT EXISTS payment_months INTEGER[] DEFAULT NULL;

-- Add worker type and freelance fields to bp_personnel
ALTER TABLE public.bp_personnel 
ADD COLUMN IF NOT EXISTS worker_type TEXT DEFAULT 'employee' CHECK (worker_type IN ('employee', 'freelance', 'intern'));

ALTER TABLE public.bp_personnel 
ADD COLUMN IF NOT EXISTS daily_rate NUMERIC DEFAULT NULL;

ALTER TABLE public.bp_personnel 
ADD COLUMN IF NOT EXISTS estimated_days_per_month NUMERIC DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.bp_fixed_expenses.payment_frequency IS 'Fréquence de paiement: monthly, quarterly, biannual, annual';
COMMENT ON COLUMN public.bp_fixed_expenses.payment_months IS 'Mois de paiement (1-12) pour les charges non mensuelles';
COMMENT ON COLUMN public.bp_personnel.worker_type IS 'Type: employee (salarié), freelance, intern (stagiaire)';
COMMENT ON COLUMN public.bp_personnel.daily_rate IS 'TJM pour les freelances';
COMMENT ON COLUMN public.bp_personnel.estimated_days_per_month IS 'Jours estimés par mois pour les freelances';