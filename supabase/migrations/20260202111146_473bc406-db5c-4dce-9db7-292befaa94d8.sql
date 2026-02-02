-- ============================================
-- Migration: Unified company access for all BP & Treasury tables
-- Allows invited members to have same access as owner
-- ============================================

-- =============================================
-- 1. BP REVENUE STREAMS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own revenue streams" ON bp_revenue_streams;
DROP POLICY IF EXISTS "Users can update their own revenue streams" ON bp_revenue_streams;
DROP POLICY IF EXISTS "Users can delete their own revenue streams" ON bp_revenue_streams;

CREATE POLICY "Users can create accessible revenue streams"
ON bp_revenue_streams FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible revenue streams"
ON bp_revenue_streams FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible revenue streams"
ON bp_revenue_streams FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 2. BP FIXED EXPENSES
-- =============================================
DROP POLICY IF EXISTS "Users can create their own fixed expenses" ON bp_fixed_expenses;
DROP POLICY IF EXISTS "Users can update their own fixed expenses" ON bp_fixed_expenses;
DROP POLICY IF EXISTS "Users can delete their own fixed expenses" ON bp_fixed_expenses;

CREATE POLICY "Users can create accessible fixed expenses"
ON bp_fixed_expenses FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible fixed expenses"
ON bp_fixed_expenses FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible fixed expenses"
ON bp_fixed_expenses FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 3. BP VARIABLE EXPENSES
-- =============================================
DROP POLICY IF EXISTS "Users can create their own variable expenses" ON bp_variable_expenses;
DROP POLICY IF EXISTS "Users can update their own variable expenses" ON bp_variable_expenses;
DROP POLICY IF EXISTS "Users can delete their own variable expenses" ON bp_variable_expenses;

CREATE POLICY "Users can create accessible variable expenses"
ON bp_variable_expenses FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible variable expenses"
ON bp_variable_expenses FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible variable expenses"
ON bp_variable_expenses FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 4. BP PERSONNEL
-- =============================================
DROP POLICY IF EXISTS "Users can create their own personnel" ON bp_personnel;
DROP POLICY IF EXISTS "Users can update their own personnel" ON bp_personnel;
DROP POLICY IF EXISTS "Users can delete their own personnel" ON bp_personnel;

CREATE POLICY "Users can create accessible personnel"
ON bp_personnel FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible personnel"
ON bp_personnel FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible personnel"
ON bp_personnel FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 5. BP DIRECTORS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own directors" ON bp_directors;
DROP POLICY IF EXISTS "Users can update their own directors" ON bp_directors;
DROP POLICY IF EXISTS "Users can delete their own directors" ON bp_directors;

CREATE POLICY "Users can create accessible directors"
ON bp_directors FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible directors"
ON bp_directors FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible directors"
ON bp_directors FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 6. BP BONUSES (special: no company_id, uses personnel.company_id)
-- =============================================
DROP POLICY IF EXISTS "Users can create their own bonuses" ON bp_bonuses;
DROP POLICY IF EXISTS "Users can update their own bonuses" ON bp_bonuses;
DROP POLICY IF EXISTS "Users can delete their own bonuses" ON bp_bonuses;

CREATE POLICY "Users can create accessible bonuses"
ON bp_bonuses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bp_personnel p
    WHERE p.id = bp_bonuses.personnel_id
    AND p.company_id IS NOT NULL
    AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Users can update accessible bonuses"
ON bp_bonuses FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM bp_personnel p
    WHERE p.id = bp_bonuses.personnel_id
    AND p.company_id IS NOT NULL
    AND has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "Users can delete accessible bonuses"
ON bp_bonuses FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM bp_personnel p
    WHERE p.id = bp_bonuses.personnel_id
    AND p.company_id IS NOT NULL
    AND has_company_access(auth.uid(), p.company_id)
  )
);

-- =============================================
-- 7. BP INVESTMENTS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own investments" ON bp_investments;
DROP POLICY IF EXISTS "Users can update their own investments" ON bp_investments;
DROP POLICY IF EXISTS "Users can delete their own investments" ON bp_investments;

CREATE POLICY "Users can create accessible investments"
ON bp_investments FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible investments"
ON bp_investments FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible investments"
ON bp_investments FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 8. BP FINANCINGS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own financings" ON bp_financings;
DROP POLICY IF EXISTS "Users can update their own financings" ON bp_financings;
DROP POLICY IF EXISTS "Users can delete their own financings" ON bp_financings;

CREATE POLICY "Users can create accessible financings"
ON bp_financings FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible financings"
ON bp_financings FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible financings"
ON bp_financings FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 9. BP STOCKS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own stocks" ON bp_stocks;
DROP POLICY IF EXISTS "Users can update their own stocks" ON bp_stocks;
DROP POLICY IF EXISTS "Users can delete their own stocks" ON bp_stocks;

CREATE POLICY "Users can create accessible stocks"
ON bp_stocks FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible stocks"
ON bp_stocks FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible stocks"
ON bp_stocks FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 10. BP SETTINGS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own BP settings" ON bp_settings;
DROP POLICY IF EXISTS "Users can update their own BP settings" ON bp_settings;
DROP POLICY IF EXISTS "Users can delete their own BP settings" ON bp_settings;

CREATE POLICY "Users can create accessible BP settings"
ON bp_settings FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible BP settings"
ON bp_settings FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible BP settings"
ON bp_settings FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 11. BP NOTES
-- =============================================
DROP POLICY IF EXISTS "Users can create their own BP notes" ON bp_notes;
DROP POLICY IF EXISTS "Users can update their own BP notes" ON bp_notes;
DROP POLICY IF EXISTS "Users can delete their own BP notes" ON bp_notes;

CREATE POLICY "Users can create accessible BP notes"
ON bp_notes FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible BP notes"
ON bp_notes FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible BP notes"
ON bp_notes FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 12. BP SNAPSHOTS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own snapshots" ON bp_snapshots;
DROP POLICY IF EXISTS "Users can delete their own snapshots" ON bp_snapshots;

CREATE POLICY "Users can create accessible snapshots"
ON bp_snapshots FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible snapshots"
ON bp_snapshots FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 13. BP SCENARIOS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own scenarios" ON bp_scenarios;
DROP POLICY IF EXISTS "Users can update their own scenarios" ON bp_scenarios;
DROP POLICY IF EXISTS "Users can delete their own scenarios" ON bp_scenarios;

CREATE POLICY "Users can create accessible scenarios"
ON bp_scenarios FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible scenarios"
ON bp_scenarios FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible scenarios"
ON bp_scenarios FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 14. BP SCENARIO OVERRIDES (uses scenario.company_id)
-- =============================================
DROP POLICY IF EXISTS "Users can create their own overrides" ON bp_scenario_overrides;
DROP POLICY IF EXISTS "Users can update their own overrides" ON bp_scenario_overrides;
DROP POLICY IF EXISTS "Users can delete their own overrides" ON bp_scenario_overrides;

CREATE POLICY "Users can create accessible overrides"
ON bp_scenario_overrides FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bp_scenarios s
    WHERE s.id = bp_scenario_overrides.scenario_id
    AND s.company_id IS NOT NULL
    AND has_company_access(auth.uid(), s.company_id)
  )
);

CREATE POLICY "Users can update accessible overrides"
ON bp_scenario_overrides FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM bp_scenarios s
    WHERE s.id = bp_scenario_overrides.scenario_id
    AND s.company_id IS NOT NULL
    AND has_company_access(auth.uid(), s.company_id)
  )
);

CREATE POLICY "Users can delete accessible overrides"
ON bp_scenario_overrides FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM bp_scenarios s
    WHERE s.id = bp_scenario_overrides.scenario_id
    AND s.company_id IS NOT NULL
    AND has_company_access(auth.uid(), s.company_id)
  )
);

-- =============================================
-- 15. BP REVENUE FORECASTS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own revenue forecasts" ON bp_revenue_forecasts;
DROP POLICY IF EXISTS "Users can update their own revenue forecasts" ON bp_revenue_forecasts;
DROP POLICY IF EXISTS "Users can delete their own revenue forecasts" ON bp_revenue_forecasts;

CREATE POLICY "Users can create accessible revenue forecasts"
ON bp_revenue_forecasts FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible revenue forecasts"
ON bp_revenue_forecasts FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible revenue forecasts"
ON bp_revenue_forecasts FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 16. BUSINESS PLANS
-- =============================================
DROP POLICY IF EXISTS "Users can create their own business plans" ON business_plans;
DROP POLICY IF EXISTS "Users can update their own business plans" ON business_plans;
DROP POLICY IF EXISTS "Users can delete their own business plans" ON business_plans;

CREATE POLICY "Users can create accessible business plans"
ON business_plans FOR INSERT
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible business plans"
ON business_plans FOR UPDATE
USING (has_company_access(auth.uid(), company_id))
WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible business plans"
ON business_plans FOR DELETE
USING (has_company_access(auth.uid(), company_id));

-- =============================================
-- 17. CATEGORIES (Treasury)
-- =============================================
DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
DROP POLICY IF EXISTS "Users can create their own categories" ON categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;

CREATE POLICY "Users can view accessible categories"
ON categories FOR SELECT
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can create accessible categories"
ON categories FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can update accessible categories"
ON categories FOR UPDATE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can delete accessible categories"
ON categories FOR DELETE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- =============================================
-- 18. CATEGORY FORECASTS (Treasury)
-- =============================================
DROP POLICY IF EXISTS "Users can view their own category forecasts" ON category_forecasts;
DROP POLICY IF EXISTS "Users can create their own category forecasts" ON category_forecasts;
DROP POLICY IF EXISTS "Users can update their own category forecasts" ON category_forecasts;
DROP POLICY IF EXISTS "Users can delete their own category forecasts" ON category_forecasts;

CREATE POLICY "Users can view accessible category forecasts"
ON category_forecasts FOR SELECT
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can create accessible category forecasts"
ON category_forecasts FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can update accessible category forecasts"
ON category_forecasts FOR UPDATE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can delete accessible category forecasts"
ON category_forecasts FOR DELETE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- =============================================
-- 19. FORECASTS (Treasury)
-- =============================================
DROP POLICY IF EXISTS "Users can view their own forecasts" ON forecasts;
DROP POLICY IF EXISTS "Users can create their own forecasts" ON forecasts;
DROP POLICY IF EXISTS "Users can update their own forecasts" ON forecasts;
DROP POLICY IF EXISTS "Users can delete their own forecasts" ON forecasts;

CREATE POLICY "Users can view accessible forecasts"
ON forecasts FOR SELECT
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can create accessible forecasts"
ON forecasts FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can update accessible forecasts"
ON forecasts FOR UPDATE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can delete accessible forecasts"
ON forecasts FOR DELETE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- =============================================
-- 20. AUTOMATION RULES (Treasury)
-- =============================================
DROP POLICY IF EXISTS "Users can view their own rules" ON automation_rules;
DROP POLICY IF EXISTS "Users can create their own rules" ON automation_rules;
DROP POLICY IF EXISTS "Users can update their own rules" ON automation_rules;
DROP POLICY IF EXISTS "Users can delete their own rules" ON automation_rules;

CREATE POLICY "Users can view accessible rules"
ON automation_rules FOR SELECT
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can create accessible rules"
ON automation_rules FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can update accessible rules"
ON automation_rules FOR UPDATE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can delete accessible rules"
ON automation_rules FOR DELETE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- =============================================
-- 21. TRANSACTIONS (already has SELECT, update mutations)
-- =============================================
DROP POLICY IF EXISTS "Users can create their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

CREATE POLICY "Users can create accessible transactions"
ON transactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can update accessible transactions"
ON transactions FOR UPDATE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can delete accessible transactions"
ON transactions FOR DELETE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

-- =============================================
-- 22. INVOICES
-- =============================================
DROP POLICY IF EXISTS "Users can create their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON invoices;

CREATE POLICY "Users can create accessible invoices"
ON invoices FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can update accessible invoices"
ON invoices FOR UPDATE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);

CREATE POLICY "Users can delete accessible invoices"
ON invoices FOR DELETE
USING (
  auth.uid() = user_id
  OR (company_id IS NOT NULL AND has_company_access(auth.uid(), company_id))
);