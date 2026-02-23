-- Cleanup: Delete Bridge transactions older than company.created_at - 3 months
DELETE FROM public.transactions t
USING public.companies c
WHERE t.company_id = c.id
  AND t.source = 'bridge'
  AND t.date < (c.created_at - interval '3 months')::date
  AND t.deleted_at IS NULL;