-- Table des primes de partage de la valeur
CREATE TABLE public.bp_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_plan_id UUID NOT NULL REFERENCES public.business_plans(id) ON DELETE CASCADE,
  personnel_id UUID NOT NULL REFERENCES public.bp_personnel(id) ON DELETE CASCADE,
  bonus_type TEXT NOT NULL DEFAULT 'ppv',
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_month DATE NOT NULL,
  is_exempt BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes pour performance
CREATE INDEX idx_bp_bonuses_business_plan ON public.bp_bonuses(business_plan_id);
CREATE INDEX idx_bp_bonuses_personnel ON public.bp_bonuses(personnel_id);
CREATE INDEX idx_bp_bonuses_user ON public.bp_bonuses(user_id);

-- Enable RLS
ALTER TABLE public.bp_bonuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own bonuses"
  ON public.bp_bonuses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bonuses"
  ON public.bp_bonuses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bonuses"
  ON public.bp_bonuses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bonuses"
  ON public.bp_bonuses FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE TRIGGER update_bp_bonuses_updated_at
  BEFORE UPDATE ON public.bp_bonuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();