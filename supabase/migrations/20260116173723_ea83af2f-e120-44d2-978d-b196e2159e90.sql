-- Create business_plans table to store finalized/draft business plans
CREATE TABLE public.business_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  description TEXT,
  bp_start_date DATE DEFAULT CURRENT_DATE,
  bp_years INTEGER DEFAULT 3,
  fiscal_year_start_month INTEGER DEFAULT 1,
  fiscal_year_start_day INTEGER DEFAULT 1,
  customer_payment_delay INTEGER DEFAULT 30,
  supplier_payment_delay INTEGER DEFAULT 30,
  initial_cash NUMERIC DEFAULT 0,
  tax_regime TEXT DEFAULT 'is',
  is_pme BOOLEAN DEFAULT true,
  finalized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own business plans"
ON public.business_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own business plans"
ON public.business_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business plans"
ON public.business_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business plans"
ON public.business_plans FOR DELETE
USING (auth.uid() = user_id);

-- Add business_plan_id to existing BP tables
ALTER TABLE public.bp_revenue_streams ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_revenue_forecasts ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_fixed_expenses ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_variable_expenses ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_personnel ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_directors ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_investments ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_financings ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_stocks ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_scenarios ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;
ALTER TABLE public.bp_notes ADD COLUMN business_plan_id UUID REFERENCES public.business_plans(id) ON DELETE CASCADE;

-- Trigger for updated_at
CREATE TRIGGER update_business_plans_updated_at
BEFORE UPDATE ON public.business_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();