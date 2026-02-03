-- Add item status columns to bridge_accounts table
ALTER TABLE public.bridge_accounts
ADD COLUMN IF NOT EXISTS item_status text DEFAULT 'ok',
ADD COLUMN IF NOT EXISTS item_status_message text,
ADD COLUMN IF NOT EXISTS item_status_updated_at timestamptz;

-- Add a comment to document the status values
COMMENT ON COLUMN public.bridge_accounts.item_status IS 'Status of bank connection: ok, needs_action, error, deleted';