-- Create financing table for loans and leases
CREATE TABLE public.bp_financings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID,
  investment_id UUID REFERENCES public.bp_investments(id) ON DELETE SET NULL,
  financing_type TEXT NOT NULL DEFAULT 'loan', -- 'loan' | 'lease'
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC DEFAULT 0, -- Annual rate in %
  duration_months INTEGER DEFAULT 60,
  monthly_payment NUMERIC DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bp_financings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own financings"
ON public.bp_financings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own financings"
ON public.bp_financings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own financings"
ON public.bp_financings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own financings"
ON public.bp_financings FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_bp_financings_updated_at
BEFORE UPDATE ON public.bp_financings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();