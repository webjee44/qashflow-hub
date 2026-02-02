-- Add sort_order column to categories table for manual ordering
ALTER TABLE public.categories 
ADD COLUMN sort_order integer DEFAULT 0;

-- Create index for efficient sorting
CREATE INDEX idx_categories_sort_order ON public.categories(company_id, type, parent_id, sort_order);

-- Initialize sort_order based on current alphabetical order
WITH numbered AS (
  SELECT id, 
         ROW_NUMBER() OVER (PARTITION BY company_id, type, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) ORDER BY name) - 1 as new_order
  FROM public.categories
)
UPDATE public.categories c
SET sort_order = n.new_order
FROM numbered n
WHERE c.id = n.id;