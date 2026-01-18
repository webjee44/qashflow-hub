
-- Supprimer l'ancienne fonction et recréer avec les bonnes catégories
DROP FUNCTION IF EXISTS public.seed_demo_companies(uuid, uuid);

CREATE OR REPLACE FUNCTION public.seed_demo_companies(p_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_retail_company_id uuid;
    v_saas_company_id uuid;
    v_conseil_company_id uuid;
    v_retail_bp_id uuid;
    v_saas_bp_id uuid;
    v_conseil_bp_id uuid;
    v_retail_stream1_id uuid;
    v_retail_stream2_id uuid;
    v_saas_stream1_id uuid;
    v_saas_stream2_id uuid;
    v_saas_stream3_id uuid;
    v_conseil_stream1_id uuid;
    v_conseil_stream2_id uuid;
    v_conseil_stream3_id uuid;
BEGIN
    -- Marquer l'organisation comme démo
    UPDATE public.organizations SET is_demo = true WHERE id = p_org_id;

    -- =====================================================
    -- SOCIÉTÉ 1 : ChaussuresPro (Retail - Magasin de chaussures)
    -- =====================================================
    INSERT INTO public.companies (user_id, organization_id, name, initial_balance, is_default)
    VALUES (p_user_id, p_org_id, 'ChaussuresPro', 25000, true)
    RETURNING id INTO v_retail_company_id;

    -- Business Plan Retail
    INSERT INTO public.business_plans (user_id, company_id, name, description, status, bp_start_date, bp_years, initial_cash, customer_payment_delay, supplier_payment_delay, is_pme, tax_regime)
    VALUES (p_user_id, v_retail_company_id, 'Business Plan 2026-2028', 'Prévisionnel sur 3 ans - Franchise chaussures', 'draft', '2026-01-01', 3, 25000, 0, 30, true, 'is')
    RETURNING id INTO v_retail_bp_id;

    -- Revenus Retail
    INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, vat_rate, color)
    VALUES 
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Ventes Magasin', 'fixed', 120000, 1, 0.05, 0.20, 'hsl(142, 76%, 36%)')
    RETURNING id INTO v_retail_stream1_id;
    
    INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, vat_rate, color)
    VALUES 
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Ventes E-commerce', 'fixed', 30000, 1, 0.15, 0.20, 'hsl(200, 76%, 50%)')
    RETURNING id INTO v_retail_stream2_id;

    -- Charges Fixes Retail (avec catégories valides)
    INSERT INTO public.bp_fixed_expenses (user_id, company_id, business_plan_id, name, monthly_amount, category, start_date, payment_frequency, vat_rate, is_vat_deductible) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Loyer local commercial', 6500, 'rent', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Assurance RC Pro', 350, 'insurance', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Logiciels (caisse, compta)', 250, 'software', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Téléphonie/Internet', 150, 'utilities', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Expert-comptable', 500, 'professional_fees', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Frais bancaires', 80, 'other', '2026-01-01', 'monthly', 0, false),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Marketing local', 800, 'marketing', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Électricité', 400, 'utilities', '2026-01-01', 'monthly', 0.20, true);

    -- Charges Variables Retail
    INSERT INTO public.bp_variable_expenses (user_id, company_id, business_plan_id, name, linked_revenue_stream_id, percentage, calculation_type, category, start_date, vat_rate, is_vat_deductible) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Coût achat marchandises', v_retail_stream1_id, 45, 'percentage', 'cogs', '2026-01-01', 0.20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Commission franchise', v_retail_stream1_id, 5, 'percentage', 'other', '2026-01-01', 0.20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Frais livraison e-commerce', v_retail_stream2_id, 8, 'percentage', 'other', '2026-01-01', 0.20, true),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Frais CB/Stripe', v_retail_stream2_id, 1.5, 'percentage', 'other', '2026-01-01', 0.20, false);

    -- Personnel Retail
    INSERT INTO public.bp_personnel (user_id, company_id, business_plan_id, position, worker_type, contract_type, gross_salary, employer_charges_rate, is_executive, start_date) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Responsable boutique', 'employee', 'cdi', 2800, 0.45, false, '2026-01-01'),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Vendeur 1', 'employee', 'cdi', 1950, 0.45, false, '2026-01-01'),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Vendeur 2', 'employee', 'cdi', 1950, 0.45, false, '2026-01-01'),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Vendeur temps partiel', 'employee', 'cdd', 1100, 0.45, false, '2026-01-01'),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Community Manager', 'freelance', 'freelance', 0, 0, false, '2026-01-01');

    -- Dirigeant Retail
    INSERT INTO public.bp_directors (user_id, company_id, business_plan_id, name, status, monthly_remuneration, charges_rate, start_date) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Gérant', 'tns', 4500, 0.45, '2026-01-01');

    -- Investissements Retail
    INSERT INTO public.bp_investments (user_id, company_id, business_plan_id, name, purchase_amount, purchase_date, depreciation_years, depreciation_method, category) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Agencement boutique', 45000, '2026-01-01', 10, 'linear', 'equipment'),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Matériel informatique', 8000, '2026-01-01', 3, 'linear', 'equipment'),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Véhicule livraison', 22000, '2026-01-01', 5, 'linear', 'vehicle');

    -- Stocks Retail
    INSERT INTO public.bp_stocks (user_id, company_id, business_plan_id, name, fiscal_year, initial_stock, purchase_amount, final_stock) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Stock marchandises', 1, 180000, 810000, 200000),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Stock marchandises', 2, 200000, 850000, 220000),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Stock marchandises', 3, 220000, 900000, 240000);

    -- Financements Retail
    INSERT INTO public.bp_financings (user_id, company_id, business_plan_id, name, financing_type, amount, start_date, duration_months, interest_rate, monthly_payment) VALUES
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Capital social', 'capital', 80000, '2026-01-01', NULL, 0, 0),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Prêt BPI', 'loan', 60000, '2026-01-01', 60, 2.5, 1065),
    (p_user_id, v_retail_company_id, v_retail_bp_id, 'Compte courant associé', 'current_account', 20000, '2026-01-01', NULL, 0, 0);

    -- =====================================================
    -- SOCIÉTÉ 2 : CloudSoft (SaaS - Éditeur logiciel)
    -- =====================================================
    INSERT INTO public.companies (user_id, organization_id, name, initial_balance, is_default)
    VALUES (p_user_id, p_org_id, 'CloudSoft', 150000, false)
    RETURNING id INTO v_saas_company_id;

    -- Business Plan SaaS
    INSERT INTO public.business_plans (user_id, company_id, name, description, status, bp_start_date, bp_years, initial_cash, customer_payment_delay, supplier_payment_delay, is_pme, tax_regime)
    VALUES (p_user_id, v_saas_company_id, 'Business Plan 2026-2028', 'Prévisionnel SaaS B2B - Croissance', 'draft', '2026-01-01', 3, 150000, 30, 30, true, 'is')
    RETURNING id INTO v_saas_bp_id;

    -- Revenus SaaS (abonnements)
    INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, churn_rate, vat_rate, color)
    VALUES 
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Abonnements Starter', 'subscription', 49, 500, 0.08, 0.03, 0.20, 'hsl(142, 76%, 36%)')
    RETURNING id INTO v_saas_stream1_id;
    
    INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, churn_rate, vat_rate, color)
    VALUES 
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Abonnements Pro', 'subscription', 199, 120, 0.05, 0.02, 0.20, 'hsl(200, 76%, 50%)')
    RETURNING id INTO v_saas_stream2_id;
    
    INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, churn_rate, vat_rate, color)
    VALUES 
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Abonnements Enterprise', 'subscription', 899, 25, 0.03, 0.01, 0.20, 'hsl(280, 76%, 50%)')
    RETURNING id INTO v_saas_stream3_id;

    -- Charges Fixes SaaS
    INSERT INTO public.bp_fixed_expenses (user_id, company_id, business_plan_id, name, monthly_amount, category, start_date, payment_frequency, vat_rate, is_vat_deductible) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Coworking/Bureaux', 2800, 'rent', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Assurances', 280, 'insurance', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Logiciels (GitHub, Slack, etc.)', 1200, 'software', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Juridique/PI', 800, 'professional_fees', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Marketing SaaS (Ads, SEO)', 4000, 'marketing', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Expert-comptable', 600, 'professional_fees', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Téléphonie', 100, 'utilities', '2026-01-01', 'monthly', 0.20, true);

    -- Charges Variables SaaS
    INSERT INTO public.bp_variable_expenses (user_id, company_id, business_plan_id, name, linked_revenue_stream_id, percentage, calculation_type, category, start_date, vat_rate, is_vat_deductible) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Infrastructure Cloud (AWS)', NULL, 8, 'percentage', 'cogs', '2026-01-01', 0.20, true),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Frais Stripe', NULL, 2.4, 'percentage', 'other', '2026-01-01', 0.20, false);

    -- Personnel SaaS
    INSERT INTO public.bp_personnel (user_id, company_id, business_plan_id, position, worker_type, contract_type, gross_salary, employer_charges_rate, is_executive, start_date) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'CTO', 'employee', 'cdi', 5500, 0.45, true, '2026-01-01'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Développeur Senior 1', 'employee', 'cdi', 4200, 0.45, false, '2026-01-01'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Développeur Senior 2', 'employee', 'cdi', 4200, 0.45, false, '2026-01-01'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Développeur Junior', 'employee', 'cdi', 2800, 0.45, false, '2026-01-01'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Product Manager', 'employee', 'cdi', 4000, 0.45, true, '2026-01-01'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Customer Success', 'employee', 'cdi', 3200, 0.45, false, '2026-01-01'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Designer UI/UX', 'freelance', 'freelance', 0, 0, false, '2026-01-01');

    -- Dirigeant SaaS
    INSERT INTO public.bp_directors (user_id, company_id, business_plan_id, name, status, monthly_remuneration, charges_rate, start_date) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'CEO', 'assimile_salarie', 6000, 0.82, '2026-01-01');

    -- Investissements SaaS
    INSERT INTO public.bp_investments (user_id, company_id, business_plan_id, name, purchase_amount, purchase_date, depreciation_years, depreciation_method, category) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Développement V2 plateforme', 80000, '2026-01-01', 3, 'linear', 'intangible'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Matériel informatique équipe', 15000, '2026-01-01', 3, 'linear', 'equipment'),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Mobilier bureau', 5000, '2026-01-01', 5, 'linear', 'furniture');

    -- Financements SaaS
    INSERT INTO public.bp_financings (user_id, company_id, business_plan_id, name, financing_type, amount, start_date, duration_months, interest_rate, monthly_payment) VALUES
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Capital (levée seed)', 'capital', 400000, '2026-01-01', NULL, 0, 0),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Prêt innovation BPI', 'loan', 100000, '2026-01-01', 60, 0, 1667),
    (p_user_id, v_saas_company_id, v_saas_bp_id, 'Subvention French Tech', 'grant', 50000, '2026-01-01', NULL, 0, 0);

    -- =====================================================
    -- SOCIÉTÉ 3 : StrategiaConseil (Cabinet de conseil)
    -- =====================================================
    INSERT INTO public.companies (user_id, organization_id, name, initial_balance, is_default)
    VALUES (p_user_id, p_org_id, 'StrategiaConseil', 40000, false)
    RETURNING id INTO v_conseil_company_id;

    -- Business Plan Conseil
    INSERT INTO public.business_plans (user_id, company_id, name, description, status, bp_start_date, bp_years, initial_cash, customer_payment_delay, supplier_payment_delay, is_pme, tax_regime)
    VALUES (p_user_id, v_conseil_company_id, 'Business Plan 2026-2028', 'Prévisionnel Cabinet conseil stratégique', 'draft', '2026-01-01', 3, 40000, 45, 30, true, 'is')
    RETURNING id INTO v_conseil_bp_id;

    -- Revenus Conseil
    INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, vat_rate, color)
    VALUES 
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Missions Stratégie', 'fixed', 25000, 1, 0.10, 0.20, 'hsl(142, 76%, 36%)')
    RETURNING id INTO v_conseil_stream1_id;
    
    INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, vat_rate, color)
    VALUES 
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Missions Transformation', 'fixed', 40000, 1, 0.08, 0.20, 'hsl(200, 76%, 50%)')
    RETURNING id INTO v_conseil_stream2_id;
    
    INSERT INTO public.bp_revenue_streams (user_id, company_id, business_plan_id, name, model, monthly_price, initial_subscribers, growth_rate, churn_rate, vat_rate, color)
    VALUES 
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Accompagnement récurrent', 'subscription', 1500, 35, 0.05, 0.02, 0.20, 'hsl(280, 76%, 50%)')
    RETURNING id INTO v_conseil_stream3_id;

    -- Charges Fixes Conseil
    INSERT INTO public.bp_fixed_expenses (user_id, company_id, business_plan_id, name, monthly_amount, category, start_date, payment_frequency, vat_rate, is_vat_deductible) VALUES
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Bureaux Paris 9ème', 4500, 'rent', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Assurance RC Pro', 450, 'insurance', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Logiciels (CRM, Suite Office)', 600, 'software', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Expert-comptable', 700, 'professional_fees', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Communication/Site web', 500, 'marketing', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Téléphonie', 200, 'utilities', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Frais représentation', 800, 'other', '2026-01-01', 'monthly', 0.20, true),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Formation continue', 400, 'professional_fees', '2026-01-01', 'monthly', 0.20, true);

    -- Charges Variables Conseil
    INSERT INTO public.bp_variable_expenses (user_id, company_id, business_plan_id, name, linked_revenue_stream_id, percentage, calculation_type, category, start_date, vat_rate, is_vat_deductible) VALUES
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Sous-traitance experts', v_conseil_stream1_id, 15, 'percentage', 'subcontracting', '2026-01-01', 0.20, true),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Frais de déplacement', NULL, 3, 'percentage', 'other', '2026-01-01', 0.20, true);

    -- Personnel Conseil
    INSERT INTO public.bp_personnel (user_id, company_id, business_plan_id, position, worker_type, contract_type, gross_salary, employer_charges_rate, is_executive, start_date) VALUES
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Consultant Senior 1', 'employee', 'cdi', 4500, 0.45, true, '2026-01-01'),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Consultant Senior 2', 'employee', 'cdi', 4500, 0.45, true, '2026-01-01'),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Consultant 1', 'employee', 'cdi', 3200, 0.45, false, '2026-01-01'),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Consultant 2', 'employee', 'cdi', 3200, 0.45, false, '2026-01-01'),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Chef de projet', 'employee', 'cdi', 4000, 0.45, true, '2026-01-01'),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Assistante Administrative', 'employee', 'cdi', 2400, 0.45, false, '2026-01-01'),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Expert Data (freelance)', 'freelance', 'freelance', 0, 0, false, '2026-01-01');

    -- Dirigeant Conseil
    INSERT INTO public.bp_directors (user_id, company_id, business_plan_id, name, status, monthly_remuneration, charges_rate, start_date) VALUES
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Directeur Associé', 'assimile_salarie', 7500, 0.82, '2026-01-01');

    -- Investissements Conseil
    INSERT INTO public.bp_investments (user_id, company_id, business_plan_id, name, purchase_amount, purchase_date, depreciation_years, depreciation_method, category) VALUES
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Aménagement bureaux', 25000, '2026-01-01', 7, 'linear', 'equipment'),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Matériel informatique', 12000, '2026-01-01', 3, 'linear', 'equipment'),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Logiciel CRM propriétaire', 30000, '2026-01-01', 3, 'linear', 'intangible');

    -- Financements Conseil
    INSERT INTO public.bp_financings (user_id, company_id, business_plan_id, name, financing_type, amount, start_date, duration_months, interest_rate, monthly_payment) VALUES
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Capital social', 'capital', 50000, '2026-01-01', NULL, 0, 0),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Compte courant associés', 'current_account', 30000, '2026-01-01', NULL, 0, 0),
    (p_user_id, v_conseil_company_id, v_conseil_bp_id, 'Prêt bancaire équipement', 'loan', 40000, '2026-01-01', 48, 3, 885);

END;
$$;
