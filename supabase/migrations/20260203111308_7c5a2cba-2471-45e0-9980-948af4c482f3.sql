-- Create partner_category_mappings table
CREATE TABLE public.partner_category_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  partner_name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, partner_name)
);

-- Enable RLS
ALTER TABLE partner_category_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies using has_company_access like other tables
CREATE POLICY "Users can view accessible mappings" ON partner_category_mappings
  FOR SELECT USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can create accessible mappings" ON partner_category_mappings
  FOR INSERT WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can update accessible mappings" ON partner_category_mappings
  FOR UPDATE USING (has_company_access(auth.uid(), company_id));

CREATE POLICY "Users can delete accessible mappings" ON partner_category_mappings
  FOR DELETE USING (has_company_access(auth.uid(), company_id));