-- Add toggle settings for stocks and financing visibility
ALTER TABLE public.bp_settings 
ADD COLUMN IF NOT EXISTS show_stocks BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_financing BOOLEAN DEFAULT true;