-- Force PostgREST to reload its schema cache after RLS policy changes
NOTIFY pgrst, 'reload schema';