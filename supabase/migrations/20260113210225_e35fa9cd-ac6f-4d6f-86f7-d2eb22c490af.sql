-- Add fiscal year and BP duration settings
ALTER TABLE bp_settings 
ADD COLUMN IF NOT EXISTS fiscal_year_start_month INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS fiscal_year_start_day INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS bp_start_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS bp_years INTEGER DEFAULT 3;