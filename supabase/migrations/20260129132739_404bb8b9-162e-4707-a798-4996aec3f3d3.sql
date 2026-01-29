
-- ============================================
-- FIX: Update RLS policies on BP tables to use has_company_access
-- This allows company members to view BP data for companies they have access to
-- ============================================

-- bp_revenue_streams: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own revenue streams" ON public.bp_revenue_streams;
CREATE POLICY "Users can view accessible revenue streams" 
ON public.bp_revenue_streams 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_fixed_expenses: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own fixed expenses" ON public.bp_fixed_expenses;
CREATE POLICY "Users can view accessible fixed expenses" 
ON public.bp_fixed_expenses 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_variable_expenses: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own variable expenses" ON public.bp_variable_expenses;
CREATE POLICY "Users can view accessible variable expenses" 
ON public.bp_variable_expenses 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_personnel: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own personnel" ON public.bp_personnel;
CREATE POLICY "Users can view accessible personnel" 
ON public.bp_personnel 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_directors: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own directors" ON public.bp_directors;
CREATE POLICY "Users can view accessible directors" 
ON public.bp_directors 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_investments: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own investments" ON public.bp_investments;
CREATE POLICY "Users can view accessible investments" 
ON public.bp_investments 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_financings: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own financings" ON public.bp_financings;
CREATE POLICY "Users can view accessible financings" 
ON public.bp_financings 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_stocks: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own stocks" ON public.bp_stocks;
CREATE POLICY "Users can view accessible stocks" 
ON public.bp_stocks 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_scenarios: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own scenarios" ON public.bp_scenarios;
CREATE POLICY "Users can view accessible scenarios" 
ON public.bp_scenarios 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_notes: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own BP notes" ON public.bp_notes;
CREATE POLICY "Users can view accessible BP notes" 
ON public.bp_notes 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_settings: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own BP settings" ON public.bp_settings;
CREATE POLICY "Users can view accessible BP settings" 
ON public.bp_settings 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_snapshots: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own snapshots" ON public.bp_snapshots;
CREATE POLICY "Users can view accessible snapshots" 
ON public.bp_snapshots 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_revenue_forecasts: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own revenue forecasts" ON public.bp_revenue_forecasts;
CREATE POLICY "Users can view accessible revenue forecasts" 
ON public.bp_revenue_forecasts 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- bp_bonuses: Allow viewing for company members (via personnel -> company)
DROP POLICY IF EXISTS "Users can view their own bonuses" ON public.bp_bonuses;
CREATE POLICY "Users can view accessible bonuses" 
ON public.bp_bonuses 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM bp_personnel p 
    WHERE p.id = bp_bonuses.personnel_id 
      AND p.company_id IS NOT NULL 
      AND has_company_access(auth.uid(), p.company_id)
  )
);

-- bp_scenario_overrides: Allow viewing for company members (via scenario -> company)
DROP POLICY IF EXISTS "Users can view their own overrides" ON public.bp_scenario_overrides;
CREATE POLICY "Users can view accessible overrides" 
ON public.bp_scenario_overrides 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM bp_scenarios s 
    WHERE s.id = bp_scenario_overrides.scenario_id 
      AND s.company_id IS NOT NULL 
      AND has_company_access(auth.uid(), s.company_id)
  )
);

-- business_plans: Allow viewing for company members
DROP POLICY IF EXISTS "Users can view their own business plans" ON public.business_plans;
CREATE POLICY "Users can view accessible business plans" 
ON public.business_plans 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);
