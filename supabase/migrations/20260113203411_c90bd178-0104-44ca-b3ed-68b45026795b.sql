-- Phase 1: Personnel - Colonnes URSSAF
ALTER TABLE bp_personnel ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'cdi';
ALTER TABLE bp_personnel ADD COLUMN IF NOT EXISTS is_executive BOOLEAN DEFAULT false;
ALTER TABLE bp_personnel ADD COLUMN IF NOT EXISTS company_size TEXT DEFAULT 'small';

-- Phase 3: TVA - Colonnes sur flux de revenus et charges
ALTER TABLE bp_revenue_streams ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 0.20;
ALTER TABLE bp_fixed_expenses ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 0.20;
ALTER TABLE bp_fixed_expenses ADD COLUMN IF NOT EXISTS is_vat_deductible BOOLEAN DEFAULT true;

-- Phase 4: Table Investissements (immobilisations)
CREATE TABLE IF NOT EXISTS bp_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'equipment',
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purchase_amount NUMERIC NOT NULL DEFAULT 0,
  depreciation_years INTEGER DEFAULT 5,
  depreciation_method TEXT DEFAULT 'linear',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bp_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own investments" ON bp_investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own investments" ON bp_investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own investments" ON bp_investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own investments" ON bp_investments FOR DELETE USING (auth.uid() = user_id);

-- Phase 5: IS - Colonnes sur settings
ALTER TABLE bp_settings ADD COLUMN IF NOT EXISTS tax_regime TEXT DEFAULT 'is';
ALTER TABLE bp_settings ADD COLUMN IF NOT EXISTS is_pme BOOLEAN DEFAULT true;

-- Phase 6: Table Dirigeants
CREATE TABLE IF NOT EXISTS bp_directors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'assimile_salarie',
  monthly_remuneration NUMERIC DEFAULT 0,
  charges_rate NUMERIC DEFAULT 0.82,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bp_directors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own directors" ON bp_directors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own directors" ON bp_directors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own directors" ON bp_directors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own directors" ON bp_directors FOR DELETE USING (auth.uid() = user_id);