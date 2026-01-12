-- Add pennylane_api_key field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pennylane_api_key TEXT;