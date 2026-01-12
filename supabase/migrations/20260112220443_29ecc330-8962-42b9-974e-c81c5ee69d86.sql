-- Add parent_id column to categories table for hierarchical grouping
ALTER TABLE public.categories 
ADD COLUMN parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);

-- Add comment for documentation
COMMENT ON COLUMN public.categories.parent_id IS 'Reference to parent category for grouping. NULL means top-level category/group.';