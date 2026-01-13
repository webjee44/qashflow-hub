-- ═══════════════════════════════════════════════════════════════
-- PRIORITY 1: STOCK MANAGEMENT TABLE
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE public.bp_stocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID,
  name TEXT NOT NULL,
  initial_stock NUMERIC DEFAULT 0,
  purchase_amount NUMERIC DEFAULT 0,
  final_stock NUMERIC DEFAULT 0,
  fiscal_year INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bp_stocks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own stocks" ON public.bp_stocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own stocks" ON public.bp_stocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stocks" ON public.bp_stocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own stocks" ON public.bp_stocks FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- PRIORITY 4: ADD BAD DEBT RATE TO REVENUE STREAMS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.bp_revenue_streams ADD COLUMN IF NOT EXISTS bad_debt_rate NUMERIC DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════
-- PRIORITY 5: EXTEND FINANCING TYPES FOR CURRENT ACCOUNTS
-- ═══════════════════════════════════════════════════════════════
-- Update comment: financing_type can now be 'loan', 'lease', or 'current_account'
COMMENT ON COLUMN public.bp_financings.financing_type IS 'Type: loan, lease, or current_account (compte courant associé)';

-- Add is_blocked column for current accounts (blocked = cannot be recalled)
ALTER TABLE public.bp_financings ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- Trigger for updated_at
CREATE TRIGGER update_bp_stocks_updated_at
BEFORE UPDATE ON public.bp_stocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();