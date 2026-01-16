-- Create table for BP notes (section-specific notes for the business plan)
CREATE TABLE public.bp_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bp_notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own BP notes"
  ON public.bp_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own BP notes"
  ON public.bp_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own BP notes"
  ON public.bp_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own BP notes"
  ON public.bp_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Add unique constraint for section per company
CREATE UNIQUE INDEX bp_notes_unique_section ON public.bp_notes(user_id, company_id, section) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX bp_notes_unique_section_no_company ON public.bp_notes(user_id, section) WHERE company_id IS NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_bp_notes_updated_at
  BEFORE UPDATE ON public.bp_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();