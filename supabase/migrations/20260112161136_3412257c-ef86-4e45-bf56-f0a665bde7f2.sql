-- Create category_forecasts table for storing forecasts per category and month
CREATE TABLE public.category_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  expected_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id, month)
);

-- Enable RLS
ALTER TABLE public.category_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own category forecasts"
ON public.category_forecasts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own category forecasts"
ON public.category_forecasts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own category forecasts"
ON public.category_forecasts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own category forecasts"
ON public.category_forecasts
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_category_forecasts_updated_at
BEFORE UPDATE ON public.category_forecasts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();