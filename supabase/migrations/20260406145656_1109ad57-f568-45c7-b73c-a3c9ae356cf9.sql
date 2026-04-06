
-- Extend demo forecast data for all 3 demo companies
-- from September 2026 through March 2027 (7 additional months)
-- by repeating the last known forecast amount for each category

-- CloudSoft (da766438-35f4-496a-aba5-4f372ad9e391)
INSERT INTO category_forecasts (user_id, category_id, month, expected_amount, company_id, source, is_demo)
SELECT
  cf.user_id,
  cf.category_id,
  m.month::date,
  cf.expected_amount,
  cf.company_id,
  'manual',
  true
FROM category_forecasts cf
CROSS JOIN (
  VALUES ('2026-09-01'),('2026-10-01'),('2026-11-01'),('2026-12-01'),('2027-01-01'),('2027-02-01'),('2027-03-01')
) AS m(month)
WHERE cf.company_id = 'da766438-35f4-496a-aba5-4f372ad9e391'
  AND cf.month = '2026-08-01'
ON CONFLICT (user_id, category_id, month) DO NOTHING;

-- ChaussuresPro (b73a714c-ed37-47fb-a811-85937f4174d2)
INSERT INTO category_forecasts (user_id, category_id, month, expected_amount, company_id, source, is_demo)
SELECT
  cf.user_id,
  cf.category_id,
  m.month::date,
  -- For seasonal categories, use slight variations
  CASE
    WHEN cat.name ILIKE '%ventes boutique%' THEN
      CASE m.month
        WHEN '2026-09-01' THEN 22000
        WHEN '2026-10-01' THEN 23000
        WHEN '2026-11-01' THEN 25000
        WHEN '2026-12-01' THEN 28000
        WHEN '2027-01-01' THEN 15000
        WHEN '2027-02-01' THEN 17000
        WHEN '2027-03-01' THEN 19000
      END
    WHEN cat.name ILIKE '%ventes en ligne%' THEN
      CASE m.month
        WHEN '2026-09-01' THEN 3500
        WHEN '2026-10-01' THEN 4000
        WHEN '2026-11-01' THEN 5000
        WHEN '2026-12-01' THEN 6500
        WHEN '2027-01-01' THEN 3000
        WHEN '2027-02-01' THEN 3200
        WHEN '2027-03-01' THEN 3800
      END
    WHEN cat.name ILIKE '%fournisseurs%' THEN
      CASE m.month
        WHEN '2026-09-01' THEN 8000
        WHEN '2026-10-01' THEN 9000
        WHEN '2026-11-01' THEN 11000
        WHEN '2026-12-01' THEN 13000
        WHEN '2027-01-01' THEN 6000
        WHEN '2027-02-01' THEN 7000
        WHEN '2027-03-01' THEN 8500
      END
    WHEN cat.name ILIKE '%marketing%' THEN
      CASE m.month
        WHEN '2026-09-01' THEN 1500
        WHEN '2026-10-01' THEN 1800
        WHEN '2026-11-01' THEN 2200
        WHEN '2026-12-01' THEN 2500
        WHEN '2027-01-01' THEN 1000
        WHEN '2027-02-01' THEN 1200
        WHEN '2027-03-01' THEN 1500
      END
    ELSE cf.expected_amount
  END,
  cf.company_id,
  'manual',
  true
FROM category_forecasts cf
JOIN categories cat ON cat.id = cf.category_id
CROSS JOIN (
  VALUES ('2026-09-01'),('2026-10-01'),('2026-11-01'),('2026-12-01'),('2027-01-01'),('2027-02-01'),('2027-03-01')
) AS m(month)
WHERE cf.company_id = 'b73a714c-ed37-47fb-a811-85937f4174d2'
  AND cf.month = '2026-08-01'
ON CONFLICT (user_id, category_id, month) DO NOTHING;

-- StrategiaConseil (95c8c816-3954-4181-af68-c8cda7fd2dba)
INSERT INTO category_forecasts (user_id, category_id, month, expected_amount, company_id, source, is_demo)
SELECT
  cf.user_id,
  cf.category_id,
  m.month::date,
  CASE
    WHEN cat.name ILIKE '%missions%' THEN
      CASE m.month
        WHEN '2026-09-01' THEN 18000
        WHEN '2026-10-01' THEN 20000
        WHEN '2026-11-01' THEN 16000
        WHEN '2026-12-01' THEN 12000
        WHEN '2027-01-01' THEN 15000
        WHEN '2027-02-01' THEN 17000
        WHEN '2027-03-01' THEN 19000
      END
    WHEN cat.name ILIKE '%formations%' THEN
      CASE m.month
        WHEN '2026-09-01' THEN 5000
        WHEN '2026-10-01' THEN 6000
        WHEN '2026-11-01' THEN 4000
        WHEN '2026-12-01' THEN 3000
        WHEN '2027-01-01' THEN 4500
        WHEN '2027-02-01' THEN 5500
        WHEN '2027-03-01' THEN 6000
      END
    WHEN cat.name ILIKE '%déplacements%' THEN
      CASE m.month
        WHEN '2026-09-01' THEN 1000
        WHEN '2026-10-01' THEN 1200
        WHEN '2026-11-01' THEN 800
        WHEN '2026-12-01' THEN 600
        WHEN '2027-01-01' THEN 900
        WHEN '2027-02-01' THEN 1100
        WHEN '2027-03-01' THEN 1300
      END
    ELSE cf.expected_amount
  END,
  cf.company_id,
  'manual',
  true
FROM category_forecasts cf
JOIN categories cat ON cat.id = cf.category_id
CROSS JOIN (
  VALUES ('2026-09-01'),('2026-10-01'),('2026-11-01'),('2026-12-01'),('2027-01-01'),('2027-02-01'),('2027-03-01')
) AS m(month)
WHERE cf.company_id = '95c8c816-3954-4181-af68-c8cda7fd2dba'
  AND cf.month = '2026-08-01'
ON CONFLICT (user_id, category_id, month) DO NOTHING;
