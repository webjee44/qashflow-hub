-- First delete all objects in the bucket
DELETE FROM storage.objects WHERE bucket_id = 'data-exports';

-- Then delete the bucket
DELETE FROM storage.buckets WHERE id = 'data-exports';