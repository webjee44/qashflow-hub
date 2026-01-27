-- ============================================
-- Table: bridge_accounts
-- Maps Bridge account_id to internal company_id
-- ============================================
CREATE TABLE public.bridge_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bridge_account_id INTEGER NOT NULL UNIQUE,
  bridge_item_id INTEGER NOT NULL,
  bridge_user_uuid TEXT NOT NULL,
  name TEXT,
  iban TEXT,
  balance NUMERIC DEFAULT 0,
  account_type TEXT,
  status TEXT DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_bridge_accounts_company ON public.bridge_accounts(company_id);
CREATE INDEX idx_bridge_accounts_user_uuid ON public.bridge_accounts(bridge_user_uuid);
CREATE INDEX idx_bridge_accounts_item_id ON public.bridge_accounts(bridge_item_id);

-- Enable RLS
ALTER TABLE public.bridge_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role only - webhook uses admin client)
CREATE POLICY "Service role can manage bridge accounts"
ON public.bridge_accounts
FOR ALL
USING (true)
WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_bridge_accounts_updated_at
  BEFORE UPDATE ON public.bridge_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Table: bridge_sync_queue
-- Queue for background sync processing with retry
-- ============================================
CREATE TABLE public.bridge_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_account_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Indexes for queue processing
CREATE INDEX idx_bridge_sync_queue_status ON public.bridge_sync_queue(status);
CREATE INDEX idx_bridge_sync_queue_created ON public.bridge_sync_queue(created_at);

-- Enable RLS
ALTER TABLE public.bridge_sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS policy (service role only)
CREATE POLICY "Service role can manage sync queue"
ON public.bridge_sync_queue
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- Enable Realtime on transactions for frontend notifications
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;