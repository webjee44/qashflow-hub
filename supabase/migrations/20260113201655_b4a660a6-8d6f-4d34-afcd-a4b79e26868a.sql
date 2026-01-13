
-- =============================================
-- BUSINESS PLAN MODULE - DATABASE SCHEMA
-- =============================================

-- 1. Revenue Streams (Flux de revenus)
CREATE TABLE public.bp_revenue_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'hsl(142, 76%, 36%)',
  model TEXT DEFAULT 'fixed' CHECK (model IN ('fixed', 'units', 'growth')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bp_revenue_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own revenue streams" ON public.bp_revenue_streams
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own revenue streams" ON public.bp_revenue_streams
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own revenue streams" ON public.bp_revenue_streams
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own revenue streams" ON public.bp_revenue_streams
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bp_revenue_streams_updated_at
  BEFORE UPDATE ON public.bp_revenue_streams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Revenue Forecasts (Prévisions mensuelles par flux)
CREATE TABLE public.bp_revenue_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.bp_revenue_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC DEFAULT 0,
  units INTEGER,
  unit_price NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stream_id, month)
);

ALTER TABLE public.bp_revenue_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own revenue forecasts" ON public.bp_revenue_forecasts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own revenue forecasts" ON public.bp_revenue_forecasts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own revenue forecasts" ON public.bp_revenue_forecasts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own revenue forecasts" ON public.bp_revenue_forecasts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bp_revenue_forecasts_updated_at
  BEFORE UPDATE ON public.bp_revenue_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Fixed Expenses (Charges fixes)
CREATE TABLE public.bp_fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other' CHECK (category IN ('rent', 'insurance', 'software', 'marketing', 'utilities', 'other')),
  monthly_amount NUMERIC DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bp_fixed_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fixed expenses" ON public.bp_fixed_expenses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own fixed expenses" ON public.bp_fixed_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own fixed expenses" ON public.bp_fixed_expenses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fixed expenses" ON public.bp_fixed_expenses
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bp_fixed_expenses_updated_at
  BEFORE UPDATE ON public.bp_fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Personnel (Masse salariale)
CREATE TABLE public.bp_personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  gross_salary NUMERIC DEFAULT 0,
  employer_charges_rate NUMERIC DEFAULT 0.45,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bp_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own personnel" ON public.bp_personnel
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own personnel" ON public.bp_personnel
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own personnel" ON public.bp_personnel
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own personnel" ON public.bp_personnel
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bp_personnel_updated_at
  BEFORE UPDATE ON public.bp_personnel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Scenarios
CREATE TABLE public.bp_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  revenue_multiplier NUMERIC DEFAULT 1.0,
  expense_multiplier NUMERIC DEFAULT 1.0,
  is_default BOOLEAN DEFAULT false,
  color TEXT,
  icon TEXT DEFAULT 'TrendingUp',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bp_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scenarios" ON public.bp_scenarios
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own scenarios" ON public.bp_scenarios
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own scenarios" ON public.bp_scenarios
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own scenarios" ON public.bp_scenarios
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bp_scenarios_updated_at
  BEFORE UPDATE ON public.bp_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. BP Settings (Paramètres du Business Plan)
CREATE TABLE public.bp_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  initial_cash NUMERIC DEFAULT 0,
  customer_payment_delay INTEGER DEFAULT 30,
  supplier_payment_delay INTEGER DEFAULT 30,
  projection_months INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.bp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own BP settings" ON public.bp_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own BP settings" ON public.bp_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own BP settings" ON public.bp_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own BP settings" ON public.bp_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bp_settings_updated_at
  BEFORE UPDATE ON public.bp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_bp_revenue_streams_company ON public.bp_revenue_streams(company_id);
CREATE INDEX idx_bp_revenue_forecasts_stream ON public.bp_revenue_forecasts(stream_id);
CREATE INDEX idx_bp_revenue_forecasts_month ON public.bp_revenue_forecasts(month);
CREATE INDEX idx_bp_fixed_expenses_company ON public.bp_fixed_expenses(company_id);
CREATE INDEX idx_bp_personnel_company ON public.bp_personnel(company_id);
CREATE INDEX idx_bp_scenarios_company ON public.bp_scenarios(company_id);
