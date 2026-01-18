
-- Function to seed demo companies with complete business plan data
CREATE OR REPLACE FUNCTION public.seed_demo_companies(p_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_retail_company_id uuid;
  v_saas_company_id uuid;
  v_agency_company_id uuid;
  v_retail_bp_id uuid;
  v_saas_bp_id uuid;
  v_agency_bp_id uuid;
  v_personnel_id uuid;
BEGIN
  -- =============================================
  -- COMPANY 1: ChaussuresPro (Retail)
  -- =============================================
  INSERT INTO public.companies (name, user_id, organization_id, is_default, initial_balance)
  VALUES ('ChaussuresPro', p_user_id, p_org_id, false, 25000)
  RETURNING id INTO v_retail_company_id;

  -- Create Business Plan
  INSERT INTO public.business_plans (
    user_id, company_id, name, status, description,
    bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day,
    customer_payment_delay, supplier_payment_delay, initial_cash, tax_regime, is_pme
  ) VALUES (
    p_user_id, v_retail_company_id, 'Business Plan 2026-2028', 'draft',
    'Plan de développement du magasin de chaussures franchisé',
    '2026-01-01', 3, 1, 1, 30, 30, 25000, 'IS', true
  ) RETURNING id INTO v_retail_bp_id;

  -- BP Settings
  INSERT INTO public.bp_settings (
    user_id, company_id, bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day,
    customer_payment_delay, supplier_payment_delay, initial_cash, show_stocks, show_financing, tax_regime, is_pme
  ) VALUES (
    p_user_id, v_retail_company_id, '2026-01-01', 3, 1, 1, 30, 30, 25000, true, true, 'IS', true
  );

  -- Revenue Streams
  INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, vat_rate, color, is_active) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Ventes Magasin', 'subscription', 120000, 1, 5, 20, '#3B82F6', true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Ventes E-commerce', 'subscription', 30000, 1, 15, 20, '#10B981', true);

  -- Variable Expenses
  INSERT INTO public.bp_variable_expenses (user_id, company_id, business_plan_id, name, calculation_type, percentage, category, start_date, vat_rate) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Coût achat marchandises', 'percentage', 45, 'purchases', '2026-01-01', 20),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Commission franchise', 'percentage', 5, 'commission', '2026-01-01', 20),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Frais livraison e-commerce', 'percentage', 2, 'logistics', '2026-01-01', 20),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Frais CB/Stripe', 'percentage', 1.5, 'banking', '2026-01-01', 20);

  -- Fixed Expenses
  INSERT INTO public.bp_fixed_expenses (user_id, company_id, business_plan_id, name, monthly_amount, category, start_date, payment_frequency, vat_rate, is_vat_deductible) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Loyer local commercial', 6500, 'rent', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Assurance RC Pro', 350, 'insurance', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Logiciels (caisse, compta)', 250, 'software', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Téléphonie/Internet', 150, 'telecom', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Expert-comptable', 500, 'accounting', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Frais bancaires', 80, 'banking', '2026-01-01', 'monthly', 0, false),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Marketing local', 800, 'marketing', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Électricité', 400, 'utilities', '2026-01-01', 'monthly', 20, true);

  -- Personnel
  INSERT INTO public.bp_personnel (user_id, company_id, business_plan_id, position, worker_type, contract_type, gross_salary, start_date, is_executive) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Responsable boutique', 'employee', 'CDI', 2800, '2026-01-01', false),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Vendeur 1', 'employee', 'CDI', 1950, '2026-01-01', false),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Vendeur 2', 'employee', 'CDI', 1950, '2026-01-01', false),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Vendeur temps partiel', 'employee', 'CDD', 1100, '2026-01-01', false);

  -- Freelance
  INSERT INTO public.bp_personnel (user_id, company_id, business_plan_id, position, worker_type, daily_rate, estimated_days_per_month, start_date) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Community Manager', 'freelance', 60, 10, '2026-01-01');

  -- Directors
  INSERT INTO public.bp_directors (user_id, company_id, business_plan_id, name, monthly_remuneration, charges_rate, start_date, status) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Gérant (TNS)', 4500, 45, '2026-01-01', 'tns');

  -- Investments
  INSERT INTO public.bp_investments (user_id, company_id, business_plan_id, name, purchase_amount, purchase_date, depreciation_years, depreciation_method, category) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Agencement boutique', 45000, '2026-01-01', 10, 'linear', 'fixtures'),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Matériel informatique', 8000, '2026-01-01', 3, 'linear', 'equipment'),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Véhicule livraison', 22000, '2026-01-01', 5, 'linear', 'vehicles');

  -- Stocks
  INSERT INTO public.bp_stocks (user_id, company_id, business_plan_id, name, fiscal_year, initial_stock, purchase_amount, final_stock) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Stock marchandises', 1, 180000, 810000, 200000),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Stock marchandises', 2, 200000, 850000, 220000),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Stock marchandises', 3, 220000, 900000, 240000);

  -- Financings
  INSERT INTO public.bp_financings (user_id, company_id, business_plan_id, name, financing_type, amount, start_date, duration_months, interest_rate, monthly_payment) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Capital social', 'capital', 80000, '2026-01-01', null, null, null),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Prêt BPI', 'loan', 60000, '2026-01-01', 60, 2.5, 1065),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Compte courant associé', 'capital', 20000, '2026-01-01', null, null, null);

  -- =============================================
  -- COMPANY 2: CloudSoft (SaaS)
  -- =============================================
  INSERT INTO public.companies (name, user_id, organization_id, is_default, initial_balance)
  VALUES ('CloudSoft', p_user_id, p_org_id, false, 150000)
  RETURNING id INTO v_saas_company_id;

  -- Create Business Plan
  INSERT INTO public.business_plans (
    user_id, company_id, name, status, description,
    bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day,
    customer_payment_delay, supplier_payment_delay, initial_cash, tax_regime, is_pme
  ) VALUES (
    p_user_id, v_saas_company_id, 'Business Plan 2026-2028', 'draft',
    'Plan de croissance SaaS B2B - Objectif 2M€ ARR',
    '2026-01-01', 3, 1, 1, 0, 30, 150000, 'IS', true
  ) RETURNING id INTO v_saas_bp_id;

  -- BP Settings
  INSERT INTO public.bp_settings (
    user_id, company_id, bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day,
    customer_payment_delay, supplier_payment_delay, initial_cash, show_stocks, show_financing, tax_regime, is_pme
  ) VALUES (
    p_user_id, v_saas_company_id, '2026-01-01', 3, 1, 1, 0, 30, 150000, false, true, 'IS', true
  );

  -- Revenue Streams (SaaS model with subscribers)
  INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, churn_rate, vat_rate, color, is_active) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Abonnement Starter', 'subscription', 49, 500, 8, 3, 20, '#8B5CF6', true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Abonnement Pro', 'subscription', 199, 120, 5, 2, 20, '#3B82F6', true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Abonnement Enterprise', 'subscription', 899, 25, 3, 1, 20, '#10B981', true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Setup & Intégration', 'one_time', 3000, 1, 10, null, 20, '#F59E0B', true);

  -- Variable Expenses
  INSERT INTO public.bp_variable_expenses (user_id, company_id, business_plan_id, name, calculation_type, percentage, category, start_date, vat_rate) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Infrastructure Cloud (AWS)', 'percentage', 8, 'hosting', '2026-01-01', 20),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Frais Stripe', 'percentage', 2.4, 'banking', '2026-01-01', 20),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Support client externalisé', 'percentage', 3, 'support', '2026-01-01', 20);

  -- Fixed Expenses
  INSERT INTO public.bp_fixed_expenses (user_id, company_id, business_plan_id, name, monthly_amount, category, start_date, payment_frequency, vat_rate, is_vat_deductible) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Coworking/Bureaux', 2800, 'rent', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Assurances', 280, 'insurance', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Logiciels (GitHub, Slack, Notion)', 1200, 'software', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Juridique/PI', 800, 'legal', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Marketing SaaS (Ads, SEO)', 4000, 'marketing', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Expert-comptable', 600, 'accounting', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Téléphonie', 100, 'telecom', '2026-01-01', 'monthly', 20, true);

  -- Personnel
  INSERT INTO public.bp_personnel (user_id, company_id, business_plan_id, position, worker_type, contract_type, gross_salary, start_date, is_executive) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'CTO', 'employee', 'CDI', 5500, '2026-01-01', true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Développeur Senior 1', 'employee', 'CDI', 4200, '2026-01-01', false),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Développeur Senior 2', 'employee', 'CDI', 4200, '2026-01-01', false),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Développeur Junior', 'employee', 'CDI', 2800, '2026-01-01', false),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Product Manager', 'employee', 'CDI', 4000, '2026-01-01', true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Customer Success', 'employee', 'CDI', 3200, '2026-01-01', false);

  -- Freelance
  INSERT INTO public.bp_personnel (user_id, company_id, business_plan_id, position, worker_type, daily_rate, estimated_days_per_month, start_date) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Designer UI/UX', 'freelance', 450, 8, '2026-01-01');

  -- Directors
  INSERT INTO public.bp_directors (user_id, company_id, business_plan_id, name, monthly_remuneration, charges_rate, start_date, status) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'CEO', 6000, 82, '2026-01-01', 'assimile_salarie');

  -- Investments
  INSERT INTO public.bp_investments (user_id, company_id, business_plan_id, name, purchase_amount, purchase_date, depreciation_years, depreciation_method, category) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Développement V2 plateforme', 80000, '2026-01-01', 3, 'linear', 'intangible'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Matériel informatique équipe', 15000, '2026-01-01', 3, 'linear', 'equipment'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Mobilier bureau', 5000, '2026-01-01', 5, 'linear', 'furniture');

  -- Financings
  INSERT INTO public.bp_financings (user_id, company_id, business_plan_id, name, financing_type, amount, start_date, duration_months, interest_rate, monthly_payment) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Capital (levée seed)', 'capital', 400000, '2026-01-01', null, null, null),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Prêt innovation BPI', 'loan', 100000, '2026-01-01', 60, 0, 1667),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Subvention French Tech', 'grant', 50000, '2026-01-01', null, null, null);

  -- =============================================
  -- COMPANY 3: StrategiaConseil (Agency)
  -- =============================================
  INSERT INTO public.companies (name, user_id, organization_id, is_default, initial_balance)
  VALUES ('StrategiaConseil', p_user_id, p_org_id, false, 40000)
  RETURNING id INTO v_agency_company_id;

  -- Create Business Plan
  INSERT INTO public.business_plans (
    user_id, company_id, name, status, description,
    bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day,
    customer_payment_delay, supplier_payment_delay, initial_cash, tax_regime, is_pme
  ) VALUES (
    p_user_id, v_agency_company_id, 'Business Plan 2026-2028', 'draft',
    'Plan de développement cabinet de conseil en stratégie digitale',
    '2026-01-01', 3, 1, 1, 45, 30, 40000, 'IS', true
  ) RETURNING id INTO v_agency_bp_id;

  -- BP Settings
  INSERT INTO public.bp_settings (
    user_id, company_id, bp_start_date, bp_years, fiscal_year_start_month, fiscal_year_start_day,
    customer_payment_delay, supplier_payment_delay, initial_cash, show_stocks, show_financing, tax_regime, is_pme
  ) VALUES (
    p_user_id, v_agency_company_id, '2026-01-01', 3, 1, 1, 45, 30, 40000, false, true, 'IS', true
  );

  -- Revenue Streams
  INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, vat_rate, color, is_active) VALUES
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Missions Stratégie', 'one_time', 25000, 1, 8, 20, '#EC4899', true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Missions Transformation', 'one_time', 40000, 1, 10, 20, '#8B5CF6', true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Accompagnement récurrent', 'subscription', 1500, 35, 5, 20, '#3B82F6', true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Formations', 'one_time', 8000, 1, 12, 20, '#10B981', true);

  -- Variable Expenses
  INSERT INTO public.bp_variable_expenses (user_id, company_id, business_plan_id, name, calculation_type, percentage, category, start_date, vat_rate) VALUES
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Sous-traitance experts', 'percentage', 15, 'subcontracting', '2026-01-01', 20),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Frais de déplacement', 'percentage', 3, 'travel', '2026-01-01', 20),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Outils clients (licences)', 'percentage', 1, 'software', '2026-01-01', 20);

  -- Fixed Expenses
  INSERT INTO public.bp_fixed_expenses (user_id, company_id, business_plan_id, name, monthly_amount, category, start_date, payment_frequency, vat_rate, is_vat_deductible) VALUES
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Bureaux Paris 9ème', 4500, 'rent', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Assurance RC Pro', 450, 'insurance', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Logiciels (CRM, Suite Office)', 600, 'software', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Expert-comptable', 700, 'accounting', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Communication/Site web', 500, 'marketing', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Téléphonie', 200, 'telecom', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Frais représentation', 800, 'entertainment', '2026-01-01', 'monthly', 20, true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Formation continue', 400, 'training', '2026-01-01', 'monthly', 20, true);

  -- Personnel
  INSERT INTO public.bp_personnel (user_id, company_id, business_plan_id, position, worker_type, contract_type, gross_salary, start_date, is_executive) VALUES
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Consultant Senior 1', 'employee', 'CDI', 4500, '2026-01-01', true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Consultant Senior 2', 'employee', 'CDI', 4500, '2026-01-01', true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Consultant 1', 'employee', 'CDI', 3200, '2026-01-01', false),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Consultant 2', 'employee', 'CDI', 3200, '2026-01-01', false),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Chef de projet', 'employee', 'CDI', 4000, '2026-01-01', true),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Assistante Administrative', 'employee', 'CDI', 2400, '2026-01-01', false);

  -- Freelance
  INSERT INTO public.bp_personnel (user_id, company_id, business_plan_id, position, worker_type, daily_rate, estimated_days_per_month, start_date) VALUES
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Expert Data', 'freelance', 650, 6, '2026-01-01');

  -- Directors
  INSERT INTO public.bp_directors (user_id, company_id, business_plan_id, name, monthly_remuneration, charges_rate, start_date, status) VALUES
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Directeur Associé', 7500, 82, '2026-01-01', 'assimile_salarie');

  -- Investments
  INSERT INTO public.bp_investments (user_id, company_id, business_plan_id, name, purchase_amount, purchase_date, depreciation_years, depreciation_method, category) VALUES
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Aménagement bureaux', 25000, '2026-01-01', 7, 'linear', 'fixtures'),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Matériel informatique', 12000, '2026-01-01', 3, 'linear', 'equipment'),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Logiciel CRM propriétaire', 30000, '2026-01-01', 3, 'linear', 'intangible');

  -- Financings
  INSERT INTO public.bp_financings (user_id, company_id, business_plan_id, name, financing_type, amount, start_date, duration_months, interest_rate, monthly_payment) VALUES
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Capital social', 'capital', 50000, '2026-01-01', null, null, null),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Compte courant associés', 'capital', 30000, '2026-01-01', null, null, null),
    (p_user_id, v_agency_company_id, v_agency_bp_id, 'Prêt bancaire équipement', 'loan', 40000, '2026-01-01', 48, 3, 885);

END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.seed_demo_companies(uuid, uuid) TO authenticated;
