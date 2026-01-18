-- Drop the existing function first, then recreate it
DROP FUNCTION IF EXISTS public.seed_demo_companies(uuid, uuid);

-- Recreate seed_demo_companies function with new company names
CREATE OR REPLACE FUNCTION public.seed_demo_companies(p_org_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company1_id uuid;
  v_company2_id uuid;
  v_company3_id uuid;
  v_bp1_id uuid;
  v_bp2_id uuid;
  v_bp3_id uuid;
  v_stream1_id uuid;
  v_stream2_id uuid;
  v_stream3_id uuid;
  v_stream4_id uuid;
  v_stream5_id uuid;
  v_personnel1_id uuid;
  v_personnel2_id uuid;
  v_personnel3_id uuid;
BEGIN
  -- Generate UUIDs for companies
  v_company1_id := gen_random_uuid();
  v_company2_id := gen_random_uuid();
  v_company3_id := gen_random_uuid();
  
  -- Generate UUIDs for business plans
  v_bp1_id := gen_random_uuid();
  v_bp2_id := gen_random_uuid();
  v_bp3_id := gen_random_uuid();

  -- ============================================
  -- CREATE COMPANIES
  -- ============================================
  
  -- Company 1: Retail Shoes (commerce de chaussures)
  INSERT INTO public.companies (id, user_id, organization_id, name, is_default, initial_balance, created_at, updated_at)
  VALUES (v_company1_id, p_user_id, p_org_id, 'Retail Shoes', true, 15000, now(), now());
  
  -- Company 2: CloudSoft (SaaS B2B)
  INSERT INTO public.companies (id, user_id, organization_id, name, is_default, initial_balance, created_at, updated_at)
  VALUES (v_company2_id, p_user_id, p_org_id, 'CloudSoft', false, 50000, now(), now());
  
  -- Company 3: GoodAgency (agence conseil)
  INSERT INTO public.companies (id, user_id, organization_id, name, is_default, initial_balance, created_at, updated_at)
  VALUES (v_company3_id, p_user_id, p_org_id, 'GoodAgency', false, 25000, now(), now());

  -- ============================================
  -- CREATE BUSINESS PLANS
  -- ============================================
  
  -- BP for Retail Shoes
  INSERT INTO public.business_plans (id, user_id, company_id, name, status, description, bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day, customer_payment_delay, supplier_payment_delay, initial_cash, tax_regime, is_pme, created_at, updated_at)
  VALUES (v_bp1_id, p_user_id, v_company1_id, 'Plan Retail Shoes 2025', 'draft', 'Business plan pour le développement du commerce de chaussures', '2025-01-01', 3, 1, 1, 30, 45, 15000, 'IS', true, now(), now());
  
  -- BP for CloudSoft
  INSERT INTO public.business_plans (id, user_id, company_id, name, status, description, bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day, customer_payment_delay, supplier_payment_delay, initial_cash, tax_regime, is_pme, created_at, updated_at)
  VALUES (v_bp2_id, p_user_id, v_company2_id, 'Plan CloudSoft 2025', 'draft', 'Business plan pour la croissance du SaaS B2B', '2025-01-01', 3, 1, 1, 0, 30, 50000, 'IS', true, now(), now());
  
  -- BP for GoodAgency
  INSERT INTO public.business_plans (id, user_id, company_id, name, status, description, bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day, customer_payment_delay, supplier_payment_delay, initial_cash, tax_regime, is_pme, created_at, updated_at)
  VALUES (v_bp3_id, p_user_id, v_company3_id, 'Plan GoodAgency 2025', 'draft', 'Business plan pour l''agence de conseil stratégique', '2025-01-01', 3, 1, 1, 45, 30, 25000, 'IS', true, now(), now());

  -- ============================================
  -- CREATE BP SETTINGS
  -- ============================================
  
  INSERT INTO public.bp_settings (user_id, company_id, bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day, customer_payment_delay, supplier_payment_delay, initial_cash, tax_regime, is_pme, show_stocks, show_financing, projection_months, created_at, updated_at)
  VALUES 
    (p_user_id, v_company1_id, '2025-01-01', 3, 1, 1, 30, 45, 15000, 'IS', true, true, true, 36, now(), now()),
    (p_user_id, v_company2_id, '2025-01-01', 3, 1, 1, 0, 30, 50000, 'IS', true, false, false, 36, now(), now()),
    (p_user_id, v_company3_id, '2025-01-01', 3, 1, 1, 45, 30, 25000, 'IS', true, false, true, 36, now(), now());

  -- ============================================
  -- CREATE REVENUE STREAMS
  -- ============================================
  
  -- Generate UUIDs for revenue streams
  v_stream1_id := gen_random_uuid();
  v_stream2_id := gen_random_uuid();
  v_stream3_id := gen_random_uuid();
  v_stream4_id := gen_random_uuid();
  v_stream5_id := gen_random_uuid();

  -- Retail Shoes: Ventes en boutique
  INSERT INTO public.bp_revenue_streams (id, user_id, company_id, business_plan_id, name, description, model, monthly_price, initial_subscribers, growth_rate, growth_rate_year2, growth_rate_year3, churn_rate, vat_rate, is_active, color, created_at, updated_at)
  VALUES (v_stream1_id, p_user_id, v_company1_id, v_bp1_id, 'Ventes Boutique', 'Ventes de chaussures en magasin', 'unit_sales', 85, 150, 5, 8, 10, 0, 20, true, '#3B82F6', now(), now());
  
  -- Retail Shoes: Ventes en ligne
  INSERT INTO public.bp_revenue_streams (id, user_id, company_id, business_plan_id, name, description, model, monthly_price, initial_subscribers, growth_rate, growth_rate_year2, growth_rate_year3, churn_rate, vat_rate, is_active, color, created_at, updated_at)
  VALUES (v_stream2_id, p_user_id, v_company1_id, v_bp1_id, 'E-commerce', 'Ventes de chaussures en ligne', 'unit_sales', 75, 80, 15, 20, 25, 0, 20, true, '#10B981', now(), now());

  -- CloudSoft: Abonnements SaaS
  INSERT INTO public.bp_revenue_streams (id, user_id, company_id, business_plan_id, name, description, model, monthly_price, initial_subscribers, growth_rate, growth_rate_year2, growth_rate_year3, churn_rate, vat_rate, is_active, color, created_at, updated_at)
  VALUES (v_stream3_id, p_user_id, v_company2_id, v_bp2_id, 'Abonnement Pro', 'Abonnement mensuel logiciel SaaS', 'subscription', 99, 120, 10, 15, 20, 3, 20, true, '#8B5CF6', now(), now());
  
  -- CloudSoft: Services premium
  INSERT INTO public.bp_revenue_streams (id, user_id, company_id, business_plan_id, name, description, model, monthly_price, initial_subscribers, growth_rate, growth_rate_year2, growth_rate_year3, churn_rate, vat_rate, is_active, color, created_at, updated_at)
  VALUES (v_stream4_id, p_user_id, v_company2_id, v_bp2_id, 'Support Premium', 'Services de support et formation', 'subscription', 299, 25, 8, 12, 15, 2, 20, true, '#F59E0B', now(), now());

  -- GoodAgency: Missions conseil
  INSERT INTO public.bp_revenue_streams (id, user_id, company_id, business_plan_id, name, description, model, monthly_price, initial_subscribers, growth_rate, growth_rate_year2, growth_rate_year3, churn_rate, vat_rate, is_active, color, created_at, updated_at)
  VALUES (v_stream5_id, p_user_id, v_company3_id, v_bp3_id, 'Missions Conseil', 'Prestations de conseil stratégique', 'project', 5000, 3, 5, 10, 15, 0, 20, true, '#EC4899', now(), now());

  -- ============================================
  -- CREATE FIXED EXPENSES
  -- ============================================
  
  -- Retail Shoes expenses
  INSERT INTO public.bp_fixed_expenses (user_id, company_id, business_plan_id, name, category, monthly_amount, start_date, vat_rate, is_vat_deductible, payment_frequency, created_at, updated_at)
  VALUES 
    (p_user_id, v_company1_id, v_bp1_id, 'Loyer boutique', 'Locaux', 2500, '2025-01-01', 20, true, 'monthly', now(), now()),
    (p_user_id, v_company1_id, v_bp1_id, 'Assurance commerce', 'Assurances', 350, '2025-01-01', 0, false, 'monthly', now(), now()),
    (p_user_id, v_company1_id, v_bp1_id, 'Comptabilité', 'Services externes', 400, '2025-01-01', 20, true, 'monthly', now(), now());

  -- CloudSoft expenses
  INSERT INTO public.bp_fixed_expenses (user_id, company_id, business_plan_id, name, category, monthly_amount, start_date, vat_rate, is_vat_deductible, payment_frequency, created_at, updated_at)
  VALUES 
    (p_user_id, v_company2_id, v_bp2_id, 'Hébergement Cloud', 'Infrastructure', 1200, '2025-01-01', 20, true, 'monthly', now(), now()),
    (p_user_id, v_company2_id, v_bp2_id, 'Coworking', 'Locaux', 800, '2025-01-01', 20, true, 'monthly', now(), now()),
    (p_user_id, v_company2_id, v_bp2_id, 'Licences logiciels', 'Outils', 450, '2025-01-01', 20, true, 'monthly', now(), now());

  -- GoodAgency expenses
  INSERT INTO public.bp_fixed_expenses (user_id, company_id, business_plan_id, name, category, monthly_amount, start_date, vat_rate, is_vat_deductible, payment_frequency, created_at, updated_at)
  VALUES 
    (p_user_id, v_company3_id, v_bp3_id, 'Bureau partagé', 'Locaux', 600, '2025-01-01', 20, true, 'monthly', now(), now()),
    (p_user_id, v_company3_id, v_bp3_id, 'Outils collaboratifs', 'Outils', 150, '2025-01-01', 20, true, 'monthly', now(), now());

  -- ============================================
  -- CREATE PERSONNEL
  -- ============================================
  
  v_personnel1_id := gen_random_uuid();
  v_personnel2_id := gen_random_uuid();
  v_personnel3_id := gen_random_uuid();

  -- Retail Shoes personnel
  INSERT INTO public.bp_personnel (id, user_id, company_id, business_plan_id, position, worker_type, contract_type, gross_salary, employer_charges_rate, start_date, is_executive, created_at, updated_at)
  VALUES 
    (v_personnel1_id, p_user_id, v_company1_id, v_bp1_id, 'Responsable boutique', 'employee', 'CDI', 2800, 45, '2025-01-01', false, now(), now()),
    (gen_random_uuid(), p_user_id, v_company1_id, v_bp1_id, 'Vendeur/Vendeuse', 'employee', 'CDI', 1900, 42, '2025-03-01', false, now(), now());

  -- CloudSoft personnel
  INSERT INTO public.bp_personnel (id, user_id, company_id, business_plan_id, position, worker_type, contract_type, gross_salary, employer_charges_rate, start_date, is_executive, created_at, updated_at)
  VALUES 
    (v_personnel2_id, p_user_id, v_company2_id, v_bp2_id, 'Lead Developer', 'employee', 'CDI', 4500, 45, '2025-01-01', true, now(), now()),
    (gen_random_uuid(), p_user_id, v_company2_id, v_bp2_id, 'Product Manager', 'employee', 'CDI', 3800, 45, '2025-01-01', true, now(), now()),
    (gen_random_uuid(), p_user_id, v_company2_id, v_bp2_id, 'Customer Success', 'employee', 'CDI', 2600, 42, '2025-04-01', false, now(), now());

  -- GoodAgency personnel (freelance based)
  INSERT INTO public.bp_personnel (id, user_id, company_id, business_plan_id, position, worker_type, daily_rate, estimated_days_per_month, start_date, created_at, updated_at)
  VALUES 
    (v_personnel3_id, p_user_id, v_company3_id, v_bp3_id, 'Consultant Senior', 'freelance', 650, 15, '2025-01-01', now(), now());

  -- ============================================
  -- CREATE INVESTMENTS
  -- ============================================
  
  -- Retail Shoes investments
  INSERT INTO public.bp_investments (user_id, company_id, business_plan_id, name, category, purchase_amount, purchase_date, depreciation_years, depreciation_method, created_at, updated_at)
  VALUES 
    (p_user_id, v_company1_id, v_bp1_id, 'Aménagement boutique', 'Agencements', 25000, '2025-01-15', 10, 'linear', now(), now()),
    (p_user_id, v_company1_id, v_bp1_id, 'Caisse enregistreuse', 'Matériel', 2500, '2025-01-01', 5, 'linear', now(), now());

  -- CloudSoft investments
  INSERT INTO public.bp_investments (user_id, company_id, business_plan_id, name, category, purchase_amount, purchase_date, depreciation_years, depreciation_method, created_at, updated_at)
  VALUES 
    (p_user_id, v_company2_id, v_bp2_id, 'Équipement informatique', 'Matériel informatique', 15000, '2025-01-01', 3, 'linear', now(), now());

  -- ============================================
  -- CREATE SCENARIOS
  -- ============================================
  
  -- Retail Shoes scenarios
  INSERT INTO public.bp_scenarios (user_id, company_id, business_plan_id, name, is_default, revenue_multiplier, expense_multiplier, color, icon, created_at, updated_at)
  VALUES 
    (p_user_id, v_company1_id, v_bp1_id, 'Réaliste', true, 1.0, 1.0, '#3B82F6', 'target', now(), now()),
    (p_user_id, v_company1_id, v_bp1_id, 'Optimiste', false, 1.2, 1.0, '#10B981', 'trending-up', now(), now()),
    (p_user_id, v_company1_id, v_bp1_id, 'Pessimiste', false, 0.8, 1.1, '#EF4444', 'trending-down', now(), now());

  -- CloudSoft scenarios
  INSERT INTO public.bp_scenarios (user_id, company_id, business_plan_id, name, is_default, revenue_multiplier, expense_multiplier, color, icon, created_at, updated_at)
  VALUES 
    (p_user_id, v_company2_id, v_bp2_id, 'Base', true, 1.0, 1.0, '#8B5CF6', 'target', now(), now()),
    (p_user_id, v_company2_id, v_bp2_id, 'Croissance forte', false, 1.5, 1.2, '#10B981', 'rocket', now(), now());

  -- GoodAgency scenarios
  INSERT INTO public.bp_scenarios (user_id, company_id, business_plan_id, name, is_default, revenue_multiplier, expense_multiplier, color, icon, created_at, updated_at)
  VALUES 
    (p_user_id, v_company3_id, v_bp3_id, 'Standard', true, 1.0, 1.0, '#EC4899', 'target', now(), now());

END;
$$;