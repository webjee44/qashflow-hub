-- Create storage bucket for data exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('data-exports', 'data-exports', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for data-exports bucket
-- Only admins/owners can access exports via their organization folder

CREATE POLICY "Org admins can read their exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'data-exports' 
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text 
    FROM public.organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.role IN ('owner', 'admin')
  )
);

CREATE POLICY "System can insert exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'data-exports');

CREATE POLICY "Org admins can delete their exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'data-exports' 
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text 
    FROM public.organization_members om
    WHERE om.user_id = auth.uid() 
    AND om.role IN ('owner', 'admin')
  )
);