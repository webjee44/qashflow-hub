-- Migration : Mettre à jour company_id depuis business_plan_id pour toutes les tables BP

-- Revenue streams
UPDATE bp_revenue_streams rs
SET company_id = bp.company_id
FROM business_plans bp
WHERE rs.business_plan_id = bp.id AND rs.company_id IS NULL;

-- Fixed expenses
UPDATE bp_fixed_expenses fe
SET company_id = bp.company_id
FROM business_plans bp
WHERE fe.business_plan_id = bp.id AND fe.company_id IS NULL;

-- Variable expenses
UPDATE bp_variable_expenses ve
SET company_id = bp.company_id
FROM business_plans bp
WHERE ve.business_plan_id = bp.id AND ve.company_id IS NULL;

-- Personnel
UPDATE bp_personnel p
SET company_id = bp.company_id
FROM business_plans bp
WHERE p.business_plan_id = bp.id AND p.company_id IS NULL;

-- Directors
UPDATE bp_directors d
SET company_id = bp.company_id
FROM business_plans bp
WHERE d.business_plan_id = bp.id AND d.company_id IS NULL;

-- Investments
UPDATE bp_investments i
SET company_id = bp.company_id
FROM business_plans bp
WHERE i.business_plan_id = bp.id AND i.company_id IS NULL;

-- Financings
UPDATE bp_financings f
SET company_id = bp.company_id
FROM business_plans bp
WHERE f.business_plan_id = bp.id AND f.company_id IS NULL;

-- Stocks
UPDATE bp_stocks s
SET company_id = bp.company_id
FROM business_plans bp
WHERE s.business_plan_id = bp.id;

-- Scenarios
UPDATE bp_scenarios sc
SET company_id = bp.company_id
FROM business_plans bp
WHERE sc.business_plan_id = bp.id AND sc.company_id IS NULL;

-- Revenue forecasts
UPDATE bp_revenue_forecasts rf
SET company_id = bp.company_id
FROM business_plans bp
WHERE rf.business_plan_id = bp.id AND rf.company_id IS NULL;

-- Notes
UPDATE bp_notes n
SET company_id = bp.company_id
FROM business_plans bp
WHERE n.business_plan_id = bp.id AND n.company_id IS NULL;