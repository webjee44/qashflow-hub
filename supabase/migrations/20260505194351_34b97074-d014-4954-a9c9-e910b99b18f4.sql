
INSERT INTO category_forecasts (user_id, company_id, category_id, month, expected_amount, amount_basis, source, notes)
VALUES
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-01-01', 315247.30,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-02-01', 237120.62,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-03-01', 301336.67,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-04-01', 281124.26,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-05-01', 288152.37,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-06-01', 295356.18,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-07-01', 302740.09,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-08-01', 263762.64,'ttc','manual','BP Ventes B2B TTC (HT×1,20) — saisonnalité août -15%'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-09-01', 318065.76,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-10-01', 326017.41,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-11-01', 334167.84,'ttc','manual','BP Ventes B2B TTC (HT×1,20)'),
 ('cb5d33be-14de-414b-94f7-8c5c4e0e2c9d','12ea5853-35f4-46d3-a97d-3d8f466e59d8','11a4f4cf-5f57-43cb-b678-9f52944ace8a','2026-12-01', 342522.04,'ttc','manual','BP Ventes B2B TTC (HT×1,20)')
ON CONFLICT (user_id, category_id, month) DO UPDATE SET
 expected_amount = EXCLUDED.expected_amount,
 amount_basis = EXCLUDED.amount_basis,
 source = EXCLUDED.source,
 notes = EXCLUDED.notes,
 updated_at = now();
