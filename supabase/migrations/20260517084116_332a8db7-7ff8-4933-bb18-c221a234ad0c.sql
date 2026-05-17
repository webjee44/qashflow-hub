
DO $$ BEGIN
  CREATE TYPE public.cash_flow_bucket AS ENUM (
    'revenue',
    'other_inflow',
    'fixed_expenses',
    'variable_expenses',
    'personnel',
    'payroll_taxes',
    'investments',
    'loan_payments',
    'vat_payments',
    'tax_payments'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS cash_flow_bucket public.cash_flow_bucket,
  ADD COLUMN IF NOT EXISTS cash_flow_bucket_confidence text
    CHECK (cash_flow_bucket_confidence IN ('system','suggested'));

-- Backfill: VAT payment categories
UPDATE public.categories
SET cash_flow_bucket = 'vat_payments',
    cash_flow_bucket_confidence = 'system'
WHERE is_vat_payment = true
  AND cash_flow_bucket IS NULL;

-- Backfill: well-known default names (case-insensitive, trimmed)
WITH mapping(pattern, bucket, ttype) AS (
  VALUES
    -- income
    ('ventes',           'revenue'::public.cash_flow_bucket, 'income'),
    ('ventes b2c',       'revenue', 'income'),
    ('prestations',      'revenue', 'income'),
    ('remboursements',   'other_inflow', 'income'),
    -- personnel
    ('salaires',         'personnel', 'expense'),
    ('retraite',         'personnel', 'expense'),
    ('mutuelle',         'personnel', 'expense'),
    ('ticket restau-swile','personnel', 'expense'),
    -- payroll taxes
    ('urssaf',           'payroll_taxes', 'expense'),
    ('charges sociales', 'payroll_taxes', 'expense'),
    ('prélèvement à la source', 'payroll_taxes', 'expense'),
    -- VAT / taxes
    ('tva',              'vat_payments', 'expense'),
    ('tva à payer',      'vat_payments', 'expense'),
    ('impôts et taxes',  'tax_payments', 'expense'),
    ('impôts - taxes',   'tax_payments', 'expense'),
    ('impôt sur les sociétés', 'tax_payments', 'expense'),
    -- loans
    ('prêts bancaire',   'loan_payments', 'expense'),
    ('remboursement emprunt', 'loan_payments', 'expense'),
    -- investments
    ('investissement',   'investments', 'expense'),
    -- fixed expenses
    ('loyer',            'fixed_expenses', 'expense'),
    ('assurance',        'fixed_expenses', 'expense'),
    ('assurances',       'fixed_expenses', 'expense'),
    ('logiciels',        'fixed_expenses', 'expense'),
    ('logiciels & abonnements', 'fixed_expenses', 'expense'),
    ('abonnements logiciels', 'fixed_expenses', 'expense'),
    ('téléphonie',       'fixed_expenses', 'expense'),
    ('téléphones - internet', 'fixed_expenses', 'expense'),
    ('electricité',      'fixed_expenses', 'expense'),
    ('electricité & gaz','fixed_expenses', 'expense'),
    ('honoraires comptables', 'fixed_expenses', 'expense'),
    ('honoraires',       'fixed_expenses', 'expense'),
    ('honoraires avocat','fixed_expenses', 'expense'),
    ('frais bancaires',  'fixed_expenses', 'expense'),
    -- variable expenses
    ('fournisseurs',     'variable_expenses', 'expense'),
    ('marketing',        'variable_expenses', 'expense'),
    ('frais de transports','variable_expenses', 'expense')
)
UPDATE public.categories c
SET cash_flow_bucket = m.bucket,
    cash_flow_bucket_confidence = 'system'
FROM mapping m
WHERE c.cash_flow_bucket IS NULL
  AND c.type::text = m.ttype
  AND lower(btrim(c.name)) = m.pattern;
