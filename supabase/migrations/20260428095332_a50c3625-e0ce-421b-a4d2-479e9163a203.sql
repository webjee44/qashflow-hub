-- Purge stale manual forecast overrides for categories that are now in percent_of_revenue mode.
-- These pre-existed before the categoryApi.update() purge logic was introduced and silently
-- masked the auto-computed values (see mem://features/treasury/variable-forecasting-mode).
DELETE FROM public.category_forecasts cf
USING public.categories c
WHERE cf.category_id = c.id
  AND c.forecast_mode = 'percent_of_revenue';