
-- ============================================
-- SEED DEMO TREASURY DATA
-- ============================================
-- Companies:
--   ChaussuresPro: b73a714c-ed37-47fb-a811-85937f4174d2
--   CloudSoft:     da766438-35f4-496a-aba5-4f372ad9e391
--   StrategiaConseil: 95c8c816-3954-4181-af68-c8cda7fd2dba
-- User: 2ab6f6c5-7efb-47ba-aede-b6c2b950b679

DO $$
DECLARE
  v_user_id uuid := '2ab6f6c5-7efb-47ba-aede-b6c2b950b679';
  v_cp uuid := 'b73a714c-ed37-47fb-a811-85937f4174d2';
  v_cs uuid := 'da766438-35f4-496a-aba5-4f372ad9e391';
  v_sc uuid := '95c8c816-3954-4181-af68-c8cda7fd2dba';
  -- ChaussuresPro categories
  cp_ventes_boutique uuid; cp_ventes_enligne uuid; cp_fournisseurs uuid; cp_loyer uuid;
  cp_salaires uuid; cp_marketing uuid; cp_logiciels uuid; cp_assurances uuid; cp_frais_bancaires uuid;
  -- CloudSoft categories
  cs_abonnements uuid; cs_services uuid; cs_hebergement uuid; cs_salaires uuid;
  cs_marketing uuid; cs_loyer uuid; cs_logiciels uuid; cs_frais_bancaires uuid;
  -- StrategiaConseil categories
  sc_missions uuid; sc_formations uuid; sc_soustraitance uuid; sc_salaires uuid;
  sc_deplacements uuid; sc_loyer uuid; sc_logiciels uuid; sc_frais_bancaires uuid;
BEGIN
  -- Skip if already seeded
  IF EXISTS (SELECT 1 FROM categories WHERE company_id = v_cp LIMIT 1) THEN
    RAISE NOTICE 'Demo treasury already seeded, skipping';
    RETURN;
  END IF;

  -- ============================================
  -- 1. CATEGORIES
  -- ============================================

  -- ChaussuresPro
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cp, 'Ventes boutique', 'income', 'hsl(142, 76%, 36%)', 'ShoppingBag') RETURNING id INTO cp_ventes_boutique;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cp, 'Ventes en ligne', 'income', 'hsl(200, 80%, 50%)', 'Globe') RETURNING id INTO cp_ventes_enligne;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cp, 'Fournisseurs chaussures', 'expense', 'hsl(25, 95%, 53%)', 'Package') RETURNING id INTO cp_fournisseurs;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cp, 'Loyer boutique', 'expense', 'hsl(0, 72%, 51%)', 'Home') RETURNING id INTO cp_loyer;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cp, 'Salaires', 'expense', 'hsl(262, 83%, 58%)', 'Users') RETURNING id INTO cp_salaires;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cp, 'Marketing', 'expense', 'hsl(330, 80%, 60%)', 'Megaphone') RETURNING id INTO cp_marketing;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cp, 'Logiciels', 'expense', 'hsl(220, 70%, 50%)', 'Monitor') RETURNING id INTO cp_logiciels;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cp, 'Assurances', 'expense', 'hsl(45, 90%, 50%)', 'Shield') RETURNING id INTO cp_assurances;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cp, 'Frais bancaires', 'expense', 'hsl(0, 0%, 45%)', 'Landmark') RETURNING id INTO cp_frais_bancaires;

  -- CloudSoft
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cs, 'Abonnements SaaS', 'income', 'hsl(262, 83%, 58%)', 'CreditCard') RETURNING id INTO cs_abonnements;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cs, 'Services professionnels', 'income', 'hsl(142, 76%, 36%)', 'Briefcase') RETURNING id INTO cs_services;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cs, 'Hébergement cloud', 'expense', 'hsl(200, 80%, 50%)', 'Cloud') RETURNING id INTO cs_hebergement;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cs, 'Salaires', 'expense', 'hsl(0, 72%, 51%)', 'Users') RETURNING id INTO cs_salaires;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cs, 'Marketing digital', 'expense', 'hsl(330, 80%, 60%)', 'Megaphone') RETURNING id INTO cs_marketing;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cs, 'Loyer coworking', 'expense', 'hsl(25, 95%, 53%)', 'Home') RETURNING id INTO cs_loyer;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cs, 'Logiciels & outils', 'expense', 'hsl(220, 70%, 50%)', 'Monitor') RETURNING id INTO cs_logiciels;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_cs, 'Frais bancaires', 'expense', 'hsl(0, 0%, 45%)', 'Landmark') RETURNING id INTO cs_frais_bancaires;

  -- StrategiaConseil
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_sc, 'Missions conseil', 'income', 'hsl(142, 76%, 36%)', 'Target') RETURNING id INTO sc_missions;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_sc, 'Formations', 'income', 'hsl(200, 80%, 50%)', 'GraduationCap') RETURNING id INTO sc_formations;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_sc, 'Sous-traitance', 'expense', 'hsl(25, 95%, 53%)', 'UserPlus') RETURNING id INTO sc_soustraitance;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_sc, 'Salaires', 'expense', 'hsl(262, 83%, 58%)', 'Users') RETURNING id INTO sc_salaires;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_sc, 'Déplacements', 'expense', 'hsl(330, 80%, 60%)', 'Car') RETURNING id INTO sc_deplacements;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_sc, 'Loyer bureau', 'expense', 'hsl(0, 72%, 51%)', 'Home') RETURNING id INTO sc_loyer;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_sc, 'Logiciels', 'expense', 'hsl(220, 70%, 50%)', 'Monitor') RETURNING id INTO sc_logiciels;
  INSERT INTO categories (id, user_id, company_id, name, type, color, icon) VALUES
    (gen_random_uuid(), v_user_id, v_sc, 'Frais bancaires', 'expense', 'hsl(0, 0%, 45%)', 'Landmark') RETURNING id INTO sc_frais_bancaires;

  -- ============================================
  -- 2. TRANSACTIONS - ChaussuresPro (50 transactions)
  -- ============================================
  INSERT INTO transactions (user_id, company_id, date, description, amount, type, category_id, source) VALUES
    -- Sep 2025
    (v_user_id, v_cp, '2025-09-02', 'Ventes boutique semaine 36', 8450, 'income', cp_ventes_boutique, 'manual'),
    (v_user_id, v_cp, '2025-09-05', 'Commande Shopify #1042', 2180, 'income', cp_ventes_enligne, 'manual'),
    (v_user_id, v_cp, '2025-09-08', 'Fournisseur Bata - Lot automne', 12500, 'expense', cp_fournisseurs, 'manual'),
    (v_user_id, v_cp, '2025-09-10', 'Loyer boutique rue de Rivoli - Sept', 2500, 'expense', cp_loyer, 'manual'),
    (v_user_id, v_cp, '2025-09-15', 'Ventes boutique semaine 37-38', 9200, 'income', cp_ventes_boutique, 'manual'),
    (v_user_id, v_cp, '2025-09-25', 'Virement salaires Septembre', 7800, 'expense', cp_salaires, 'manual'),
    (v_user_id, v_cp, '2025-09-28', 'Google Ads - Campagne rentree', 850, 'expense', cp_marketing, 'manual'),
    (v_user_id, v_cp, '2025-09-30', 'Frais CB et terminal paiement', 145, 'expense', cp_frais_bancaires, 'manual'),
    -- Oct 2025
    (v_user_id, v_cp, '2025-10-03', 'Ventes boutique semaine 40', 7800, 'income', cp_ventes_boutique, 'manual'),
    (v_user_id, v_cp, '2025-10-07', 'Commande Shopify #1089', 3200, 'income', cp_ventes_enligne, 'manual'),
    (v_user_id, v_cp, '2025-10-10', 'Loyer boutique rue de Rivoli - Oct', 2500, 'expense', cp_loyer, 'manual'),
    (v_user_id, v_cp, '2025-10-12', 'Fournisseur Nike - Collection hiver', 18000, 'expense', cp_fournisseurs, 'manual'),
    (v_user_id, v_cp, '2025-10-18', 'Ventes boutique semaine 41-42', 11500, 'income', cp_ventes_boutique, 'manual'),
    (v_user_id, v_cp, '2025-10-20', 'Assurance multirisque commerce', 350, 'expense', cp_assurances, 'manual'),
    (v_user_id, v_cp, '2025-10-25', 'Virement salaires Octobre', 7800, 'expense', cp_salaires, 'manual'),
    (v_user_id, v_cp, '2025-10-28', 'Abonnement Shopify Pro', 79, 'expense', cp_logiciels, 'manual'),
    (v_user_id, v_cp, '2025-10-31', 'Paiement inconnu virement', 1250, 'income', NULL, 'manual'),
    -- Nov 2025
    (v_user_id, v_cp, '2025-11-04', 'Ventes boutique semaine 44-45', 13200, 'income', cp_ventes_boutique, 'manual'),
    (v_user_id, v_cp, '2025-11-08', 'Black Friday - Ventes en ligne', 8900, 'income', cp_ventes_enligne, 'manual'),
    (v_user_id, v_cp, '2025-11-10', 'Loyer boutique rue de Rivoli - Nov', 2500, 'expense', cp_loyer, 'manual'),
    (v_user_id, v_cp, '2025-11-15', 'Fournisseur Adidas - Restockage', 9500, 'expense', cp_fournisseurs, 'manual'),
    (v_user_id, v_cp, '2025-11-20', 'Campagne Instagram Black Friday', 1500, 'expense', cp_marketing, 'manual'),
    (v_user_id, v_cp, '2025-11-25', 'Virement salaires Novembre', 7800, 'expense', cp_salaires, 'manual'),
    (v_user_id, v_cp, '2025-11-28', 'VRT SEPA recu - origine inconnue', 890, 'income', NULL, 'manual'),
    -- Dec 2025
    (v_user_id, v_cp, '2025-12-02', 'Ventes Noel boutique', 18500, 'income', cp_ventes_boutique, 'manual'),
    (v_user_id, v_cp, '2025-12-05', 'Ventes Noel en ligne', 6200, 'income', cp_ventes_enligne, 'manual'),
    (v_user_id, v_cp, '2025-12-10', 'Loyer boutique rue de Rivoli - Dec', 2500, 'expense', cp_loyer, 'manual'),
    (v_user_id, v_cp, '2025-12-15', 'Prime de Noel personnel', 1200, 'expense', cp_salaires, 'manual'),
    (v_user_id, v_cp, '2025-12-20', 'Fournisseur Puma - Soldes', 7200, 'expense', cp_fournisseurs, 'manual'),
    (v_user_id, v_cp, '2025-12-25', 'Virement salaires Decembre', 7800, 'expense', cp_salaires, 'manual'),
    (v_user_id, v_cp, '2025-12-30', 'Frais bancaires trimestriels', 220, 'expense', cp_frais_bancaires, 'manual'),
    -- Jan 2026
    (v_user_id, v_cp, '2026-01-05', 'Soldes hiver - Ventes boutique', 14200, 'income', cp_ventes_boutique, 'manual'),
    (v_user_id, v_cp, '2026-01-08', 'Soldes hiver - Ventes en ligne', 5800, 'income', cp_ventes_enligne, 'manual'),
    (v_user_id, v_cp, '2026-01-10', 'Loyer boutique rue de Rivoli - Jan', 2500, 'expense', cp_loyer, 'manual'),
    (v_user_id, v_cp, '2026-01-15', 'Fournisseur New Balance - Printemps', 11000, 'expense', cp_fournisseurs, 'manual'),
    (v_user_id, v_cp, '2026-01-20', 'Comptabilite honoraires annuels', 2400, 'expense', NULL, 'manual'),
    (v_user_id, v_cp, '2026-01-25', 'Virement salaires Janvier', 7800, 'expense', cp_salaires, 'manual'),
    (v_user_id, v_cp, '2026-01-28', 'Assurance multirisque commerce Q1', 350, 'expense', cp_assurances, 'manual'),
    -- Feb 2026
    (v_user_id, v_cp, '2026-02-03', 'Ventes boutique semaine 6', 6800, 'income', cp_ventes_boutique, 'manual'),
    (v_user_id, v_cp, '2026-02-06', 'Commande Shopify #1210', 2900, 'income', cp_ventes_enligne, 'manual'),
    (v_user_id, v_cp, '2026-02-10', 'Loyer boutique rue de Rivoli - Fev', 2500, 'expense', cp_loyer, 'manual'),
    (v_user_id, v_cp, '2026-02-12', 'Virement recu non identifie', 3500, 'income', NULL, 'manual'),
    (v_user_id, v_cp, '2026-02-14', 'Google Ads - Saint Valentin', 650, 'expense', cp_marketing, 'manual');

  -- ============================================
  -- 2. TRANSACTIONS - CloudSoft (50 transactions)
  -- ============================================
  INSERT INTO transactions (user_id, company_id, date, description, amount, type, category_id, source) VALUES
    -- Sep 2025
    (v_user_id, v_cs, '2025-09-01', 'Abonnement mensuel - TechCorp SAS', 4950, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-09-01', 'Abonnement mensuel - DataFlow SARL', 2970, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-09-03', 'Abonnement mensuel - LogiPro', 990, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-09-05', 'AWS Hosting - Septembre', 1180, 'expense', cs_hebergement, 'manual'),
    (v_user_id, v_cs, '2025-09-10', 'Loyer coworking WeWork - Sept', 800, 'expense', cs_loyer, 'manual'),
    (v_user_id, v_cs, '2025-09-15', 'Mission conseil migration cloud - Airbus', 8500, 'income', cs_services, 'manual'),
    (v_user_id, v_cs, '2025-09-25', 'Virement salaires Septembre', 28500, 'expense', cs_salaires, 'manual'),
    (v_user_id, v_cs, '2025-09-28', 'Google Ads - Lead gen SaaS', 1200, 'expense', cs_marketing, 'manual'),
    (v_user_id, v_cs, '2025-09-30', 'Frais bancaires mensuels', 35, 'expense', cs_frais_bancaires, 'manual'),
    -- Oct 2025
    (v_user_id, v_cs, '2025-10-01', 'Abonnement mensuel - TechCorp SAS', 4950, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-10-01', 'Abonnement mensuel - DataFlow SARL', 2970, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-10-01', 'Abonnement mensuel - LogiPro', 990, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-10-01', 'Nouveau client - InnoVate SAS', 1980, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-10-05', 'AWS Hosting - Octobre', 1250, 'expense', cs_hebergement, 'manual'),
    (v_user_id, v_cs, '2025-10-10', 'Loyer coworking WeWork - Oct', 800, 'expense', cs_loyer, 'manual'),
    (v_user_id, v_cs, '2025-10-15', 'Licence GitHub Enterprise', 210, 'expense', cs_logiciels, 'manual'),
    (v_user_id, v_cs, '2025-10-25', 'Virement salaires Octobre', 28500, 'expense', cs_salaires, 'manual'),
    (v_user_id, v_cs, '2025-10-28', 'Paiement recu non identifie', 3200, 'income', NULL, 'manual'),
    -- Nov 2025
    (v_user_id, v_cs, '2025-11-01', 'Abonnement mensuel - TechCorp SAS', 4950, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-11-01', 'Abonnement mensuel - DataFlow SARL', 2970, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-11-01', 'Abonnement mensuel - InnoVate SAS', 1980, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-11-05', 'AWS Hosting - Novembre', 1320, 'expense', cs_hebergement, 'manual'),
    (v_user_id, v_cs, '2025-11-10', 'Loyer coworking WeWork - Nov', 800, 'expense', cs_loyer, 'manual'),
    (v_user_id, v_cs, '2025-11-12', 'Formation equipe Kubernetes', 3500, 'expense', NULL, 'manual'),
    (v_user_id, v_cs, '2025-11-25', 'Virement salaires Novembre', 28500, 'expense', cs_salaires, 'manual'),
    (v_user_id, v_cs, '2025-11-28', 'LinkedIn Ads - Recrutement dev', 950, 'expense', cs_marketing, 'manual'),
    -- Dec 2025
    (v_user_id, v_cs, '2025-12-01', 'Abonnement mensuel - TechCorp SAS', 4950, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-12-01', 'Abonnement mensuel - DataFlow SARL', 2970, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-12-01', 'Abonnement mensuel - InnoVate SAS', 1980, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-12-01', 'Nouveau client - SmartRetail', 3960, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2025-12-05', 'AWS Hosting - Decembre', 1400, 'expense', cs_hebergement, 'manual'),
    (v_user_id, v_cs, '2025-12-10', 'Loyer coworking WeWork - Dec', 800, 'expense', cs_loyer, 'manual'),
    (v_user_id, v_cs, '2025-12-20', 'Prime fin annee equipe', 4500, 'expense', cs_salaires, 'manual'),
    (v_user_id, v_cs, '2025-12-25', 'Virement salaires Decembre', 28500, 'expense', cs_salaires, 'manual'),
    -- Jan 2026
    (v_user_id, v_cs, '2026-01-01', 'Abonnement mensuel - TechCorp SAS', 4950, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2026-01-01', 'Abonnement mensuel - DataFlow SARL', 2970, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2026-01-01', 'Abonnement mensuel - InnoVate SAS', 1980, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2026-01-01', 'Abonnement mensuel - SmartRetail', 3960, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2026-01-05', 'AWS Hosting - Janvier', 1450, 'expense', cs_hebergement, 'manual'),
    (v_user_id, v_cs, '2026-01-10', 'Loyer coworking WeWork - Jan', 800, 'expense', cs_loyer, 'manual'),
    (v_user_id, v_cs, '2026-01-15', 'Mission audit securite - BNP', 12000, 'income', cs_services, 'manual'),
    (v_user_id, v_cs, '2026-01-25', 'Virement salaires Janvier', 28500, 'expense', cs_salaires, 'manual'),
    (v_user_id, v_cs, '2026-01-28', 'Virement inconnu SEPA', 5600, 'income', NULL, 'manual'),
    -- Feb 2026
    (v_user_id, v_cs, '2026-02-01', 'Abonnement mensuel - TechCorp SAS', 4950, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2026-02-01', 'Abonnement mensuel - SmartRetail', 3960, 'income', cs_abonnements, 'manual'),
    (v_user_id, v_cs, '2026-02-05', 'AWS Hosting - Fevrier', 1500, 'expense', cs_hebergement, 'manual'),
    (v_user_id, v_cs, '2026-02-10', 'Loyer coworking WeWork - Fev', 800, 'expense', cs_loyer, 'manual'),
    (v_user_id, v_cs, '2026-02-12', 'Renouvellement Slack Business', 450, 'expense', cs_logiciels, 'manual');

  -- ============================================
  -- 2. TRANSACTIONS - StrategiaConseil (45 transactions)
  -- ============================================
  INSERT INTO transactions (user_id, company_id, date, description, amount, type, category_id, source) VALUES
    -- Sep 2025
    (v_user_id, v_sc, '2025-09-02', 'Mission conseil strategique - Carrefour', 15000, 'income', sc_missions, 'manual'),
    (v_user_id, v_sc, '2025-09-05', 'Formation management equipe - SNCF', 4500, 'income', sc_formations, 'manual'),
    (v_user_id, v_sc, '2025-09-08', 'Sous-traitant consultant junior', 3200, 'expense', sc_soustraitance, 'manual'),
    (v_user_id, v_sc, '2025-09-10', 'Loyer bureau Neuilly - Sept', 1800, 'expense', sc_loyer, 'manual'),
    (v_user_id, v_sc, '2025-09-15', 'Deplacement client Lyon TGV + hotel', 580, 'expense', sc_deplacements, 'manual'),
    (v_user_id, v_sc, '2025-09-25', 'Honoraires consultant Sept', 9750, 'expense', sc_salaires, 'manual'),
    (v_user_id, v_sc, '2025-09-30', 'Frais bancaires mensuels', 25, 'expense', sc_frais_bancaires, 'manual'),
    -- Oct 2025
    (v_user_id, v_sc, '2025-10-01', 'Mission conseil transformation digitale - L''Oreal', 22000, 'income', sc_missions, 'manual'),
    (v_user_id, v_sc, '2025-10-08', 'Sous-traitant designer UX', 2800, 'expense', sc_soustraitance, 'manual'),
    (v_user_id, v_sc, '2025-10-10', 'Loyer bureau Neuilly - Oct', 1800, 'expense', sc_loyer, 'manual'),
    (v_user_id, v_sc, '2025-10-12', 'Billet avion Paris-Bruxelles client', 320, 'expense', sc_deplacements, 'manual'),
    (v_user_id, v_sc, '2025-10-20', 'Licence Notion Team', 120, 'expense', sc_logiciels, 'manual'),
    (v_user_id, v_sc, '2025-10-25', 'Honoraires consultant Oct', 9750, 'expense', sc_salaires, 'manual'),
    (v_user_id, v_sc, '2025-10-28', 'Virement recu - origine inconnue', 2100, 'income', NULL, 'manual'),
    -- Nov 2025
    (v_user_id, v_sc, '2025-11-03', 'Mission conseil RH - Danone', 12000, 'income', sc_missions, 'manual'),
    (v_user_id, v_sc, '2025-11-05', 'Formation leadership - BNP Paribas', 6000, 'income', sc_formations, 'manual'),
    (v_user_id, v_sc, '2025-11-10', 'Loyer bureau Neuilly - Nov', 1800, 'expense', sc_loyer, 'manual'),
    (v_user_id, v_sc, '2025-11-15', 'Sous-traitant data analyst', 4500, 'expense', sc_soustraitance, 'manual'),
    (v_user_id, v_sc, '2025-11-18', 'Hotel + restaurant client Marseille', 450, 'expense', sc_deplacements, 'manual'),
    (v_user_id, v_sc, '2025-11-25', 'Honoraires consultant Nov', 9750, 'expense', sc_salaires, 'manual'),
    -- Dec 2025
    (v_user_id, v_sc, '2025-12-01', 'Mission conseil strategie ESG - TotalEnergies', 25000, 'income', sc_missions, 'manual'),
    (v_user_id, v_sc, '2025-12-10', 'Loyer bureau Neuilly - Dec', 1800, 'expense', sc_loyer, 'manual'),
    (v_user_id, v_sc, '2025-12-15', 'Prime fin annee consultant', 3000, 'expense', sc_salaires, 'manual'),
    (v_user_id, v_sc, '2025-12-20', 'Cadeau client fin annee', 650, 'expense', NULL, 'manual'),
    (v_user_id, v_sc, '2025-12-25', 'Honoraires consultant Dec', 9750, 'expense', sc_salaires, 'manual'),
    -- Jan 2026
    (v_user_id, v_sc, '2026-01-05', 'Mission conseil innovation - Renault', 18000, 'income', sc_missions, 'manual'),
    (v_user_id, v_sc, '2026-01-08', 'Formation gestion de projet - Thales', 5500, 'income', sc_formations, 'manual'),
    (v_user_id, v_sc, '2026-01-10', 'Loyer bureau Neuilly - Jan', 1800, 'expense', sc_loyer, 'manual'),
    (v_user_id, v_sc, '2026-01-12', 'Sous-traitant consultant senior', 5200, 'expense', sc_soustraitance, 'manual'),
    (v_user_id, v_sc, '2026-01-15', 'Deplacement Bordeaux - 2 jours', 720, 'expense', sc_deplacements, 'manual'),
    (v_user_id, v_sc, '2026-01-20', 'Renouvellement Miro Pro', 96, 'expense', sc_logiciels, 'manual'),
    (v_user_id, v_sc, '2026-01-25', 'Honoraires consultant Jan', 9750, 'expense', sc_salaires, 'manual'),
    (v_user_id, v_sc, '2026-01-30', 'Virement inconnu', 1800, 'income', NULL, 'manual'),
    -- Feb 2026
    (v_user_id, v_sc, '2026-02-03', 'Mission conseil supply chain - Michelin', 14000, 'income', sc_missions, 'manual'),
    (v_user_id, v_sc, '2026-02-10', 'Loyer bureau Neuilly - Fev', 1800, 'expense', sc_loyer, 'manual'),
    (v_user_id, v_sc, '2026-02-12', 'Deplacement client Strasbourg', 390, 'expense', sc_deplacements, 'manual');

  -- ============================================
  -- 3. AUTOMATION RULES
  -- ============================================

  -- ChaussuresPro rules
  INSERT INTO automation_rules (user_id, company_id, name, condition_field, condition_operator, condition_value, target_category_id, is_active, match_count) VALUES
    (v_user_id, v_cp, 'Salaires mensuels', 'description', 'contains', 'salaire', cp_salaires, true, 12),
    (v_user_id, v_cp, 'Loyer boutique', 'description', 'contains', 'loyer boutique', cp_loyer, true, 6),
    (v_user_id, v_cp, 'Ventes boutique', 'description', 'contains', 'ventes boutique', cp_ventes_boutique, true, 10),
    (v_user_id, v_cp, 'Fournisseurs', 'description', 'contains', 'fournisseur', cp_fournisseurs, true, 8),
    (v_user_id, v_cp, 'Frais bancaires', 'description', 'contains', 'frais bancaires', cp_frais_bancaires, true, 4);

  -- CloudSoft rules
  INSERT INTO automation_rules (user_id, company_id, name, condition_field, condition_operator, condition_value, target_category_id, is_active, match_count) VALUES
    (v_user_id, v_cs, 'Abonnements mensuels', 'description', 'contains', 'abonnement mensuel', cs_abonnements, true, 24),
    (v_user_id, v_cs, 'AWS Hosting', 'description', 'contains', 'AWS Hosting', cs_hebergement, true, 6),
    (v_user_id, v_cs, 'Salaires equipe', 'description', 'contains', 'salaire', cs_salaires, true, 6),
    (v_user_id, v_cs, 'Loyer WeWork', 'description', 'contains', 'WeWork', cs_loyer, true, 6),
    (v_user_id, v_cs, 'Missions services', 'description', 'contains', 'mission', cs_services, true, 3);

  -- StrategiaConseil rules
  INSERT INTO automation_rules (user_id, company_id, name, condition_field, condition_operator, condition_value, target_category_id, is_active, match_count) VALUES
    (v_user_id, v_sc, 'Missions conseil', 'description', 'contains', 'mission conseil', sc_missions, true, 10),
    (v_user_id, v_sc, 'Formations', 'description', 'contains', 'formation', sc_formations, true, 4),
    (v_user_id, v_sc, 'Honoraires consultant', 'description', 'contains', 'honoraires', sc_salaires, true, 6),
    (v_user_id, v_sc, 'Loyer bureau', 'description', 'contains', 'loyer bureau', sc_loyer, true, 6),
    (v_user_id, v_sc, 'Sous-traitance', 'description', 'contains', 'sous-traitant', sc_soustraitance, true, 5);

  -- ============================================
  -- 4. CATEGORY FORECASTS (Mar-Aug 2026)
  -- ============================================

  -- ChaussuresPro forecasts
  INSERT INTO category_forecasts (user_id, company_id, category_id, month, expected_amount, source) VALUES
    -- Ventes boutique
    (v_user_id, v_cp, cp_ventes_boutique, '2026-03-01', 12000, 'manual'),
    (v_user_id, v_cp, cp_ventes_boutique, '2026-04-01', 10500, 'manual'),
    (v_user_id, v_cp, cp_ventes_boutique, '2026-05-01', 11000, 'manual'),
    (v_user_id, v_cp, cp_ventes_boutique, '2026-06-01', 9500, 'manual'),
    (v_user_id, v_cp, cp_ventes_boutique, '2026-07-01', 7500, 'manual'),
    (v_user_id, v_cp, cp_ventes_boutique, '2026-08-01', 6000, 'manual'),
    -- Ventes en ligne
    (v_user_id, v_cp, cp_ventes_enligne, '2026-03-01', 4000, 'manual'),
    (v_user_id, v_cp, cp_ventes_enligne, '2026-04-01', 3800, 'manual'),
    (v_user_id, v_cp, cp_ventes_enligne, '2026-05-01', 4200, 'manual'),
    (v_user_id, v_cp, cp_ventes_enligne, '2026-06-01', 3500, 'manual'),
    (v_user_id, v_cp, cp_ventes_enligne, '2026-07-01', 3000, 'manual'),
    (v_user_id, v_cp, cp_ventes_enligne, '2026-08-01', 2500, 'manual'),
    -- Fournisseurs
    (v_user_id, v_cp, cp_fournisseurs, '2026-03-01', -10000, 'manual'),
    (v_user_id, v_cp, cp_fournisseurs, '2026-04-01', -8000, 'manual'),
    (v_user_id, v_cp, cp_fournisseurs, '2026-05-01', -9000, 'manual'),
    (v_user_id, v_cp, cp_fournisseurs, '2026-06-01', -12000, 'manual'),
    (v_user_id, v_cp, cp_fournisseurs, '2026-07-01', -7000, 'manual'),
    (v_user_id, v_cp, cp_fournisseurs, '2026-08-01', -5000, 'manual'),
    -- Loyer
    (v_user_id, v_cp, cp_loyer, '2026-03-01', -2500, 'manual'),
    (v_user_id, v_cp, cp_loyer, '2026-04-01', -2500, 'manual'),
    (v_user_id, v_cp, cp_loyer, '2026-05-01', -2500, 'manual'),
    (v_user_id, v_cp, cp_loyer, '2026-06-01', -2500, 'manual'),
    (v_user_id, v_cp, cp_loyer, '2026-07-01', -2500, 'manual'),
    (v_user_id, v_cp, cp_loyer, '2026-08-01', -2500, 'manual'),
    -- Salaires
    (v_user_id, v_cp, cp_salaires, '2026-03-01', -7800, 'manual'),
    (v_user_id, v_cp, cp_salaires, '2026-04-01', -7800, 'manual'),
    (v_user_id, v_cp, cp_salaires, '2026-05-01', -7800, 'manual'),
    (v_user_id, v_cp, cp_salaires, '2026-06-01', -7800, 'manual'),
    (v_user_id, v_cp, cp_salaires, '2026-07-01', -7800, 'manual'),
    (v_user_id, v_cp, cp_salaires, '2026-08-01', -7800, 'manual');

  -- CloudSoft forecasts
  INSERT INTO category_forecasts (user_id, company_id, category_id, month, expected_amount, source) VALUES
    -- Abonnements SaaS (croissance)
    (v_user_id, v_cs, cs_abonnements, '2026-03-01', 16000, 'manual'),
    (v_user_id, v_cs, cs_abonnements, '2026-04-01', 17000, 'manual'),
    (v_user_id, v_cs, cs_abonnements, '2026-05-01', 18000, 'manual'),
    (v_user_id, v_cs, cs_abonnements, '2026-06-01', 19500, 'manual'),
    (v_user_id, v_cs, cs_abonnements, '2026-07-01', 20500, 'manual'),
    (v_user_id, v_cs, cs_abonnements, '2026-08-01', 22000, 'manual'),
    -- Services
    (v_user_id, v_cs, cs_services, '2026-03-01', 8000, 'manual'),
    (v_user_id, v_cs, cs_services, '2026-04-01', 5000, 'manual'),
    (v_user_id, v_cs, cs_services, '2026-05-01', 10000, 'manual'),
    (v_user_id, v_cs, cs_services, '2026-06-01', 6000, 'manual'),
    (v_user_id, v_cs, cs_services, '2026-07-01', 4000, 'manual'),
    (v_user_id, v_cs, cs_services, '2026-08-01', 7000, 'manual'),
    -- Hebergement
    (v_user_id, v_cs, cs_hebergement, '2026-03-01', -1550, 'manual'),
    (v_user_id, v_cs, cs_hebergement, '2026-04-01', -1600, 'manual'),
    (v_user_id, v_cs, cs_hebergement, '2026-05-01', -1650, 'manual'),
    (v_user_id, v_cs, cs_hebergement, '2026-06-01', -1700, 'manual'),
    (v_user_id, v_cs, cs_hebergement, '2026-07-01', -1750, 'manual'),
    (v_user_id, v_cs, cs_hebergement, '2026-08-01', -1800, 'manual'),
    -- Salaires
    (v_user_id, v_cs, cs_salaires, '2026-03-01', -28500, 'manual'),
    (v_user_id, v_cs, cs_salaires, '2026-04-01', -28500, 'manual'),
    (v_user_id, v_cs, cs_salaires, '2026-05-01', -28500, 'manual'),
    (v_user_id, v_cs, cs_salaires, '2026-06-01', -28500, 'manual'),
    (v_user_id, v_cs, cs_salaires, '2026-07-01', -28500, 'manual'),
    (v_user_id, v_cs, cs_salaires, '2026-08-01', -28500, 'manual');

  -- StrategiaConseil forecasts
  INSERT INTO category_forecasts (user_id, company_id, category_id, month, expected_amount, source) VALUES
    -- Missions conseil
    (v_user_id, v_sc, sc_missions, '2026-03-01', 18000, 'manual'),
    (v_user_id, v_sc, sc_missions, '2026-04-01', 15000, 'manual'),
    (v_user_id, v_sc, sc_missions, '2026-05-01', 20000, 'manual'),
    (v_user_id, v_sc, sc_missions, '2026-06-01', 16000, 'manual'),
    (v_user_id, v_sc, sc_missions, '2026-07-01', 10000, 'manual'),
    (v_user_id, v_sc, sc_missions, '2026-08-01', 8000, 'manual'),
    -- Formations
    (v_user_id, v_sc, sc_formations, '2026-03-01', 5000, 'manual'),
    (v_user_id, v_sc, sc_formations, '2026-04-01', 6000, 'manual'),
    (v_user_id, v_sc, sc_formations, '2026-05-01', 4500, 'manual'),
    (v_user_id, v_sc, sc_formations, '2026-06-01', 5500, 'manual'),
    (v_user_id, v_sc, sc_formations, '2026-07-01', 3000, 'manual'),
    (v_user_id, v_sc, sc_formations, '2026-08-01', 2000, 'manual'),
    -- Salaires
    (v_user_id, v_sc, sc_salaires, '2026-03-01', -9750, 'manual'),
    (v_user_id, v_sc, sc_salaires, '2026-04-01', -9750, 'manual'),
    (v_user_id, v_sc, sc_salaires, '2026-05-01', -9750, 'manual'),
    (v_user_id, v_sc, sc_salaires, '2026-06-01', -9750, 'manual'),
    (v_user_id, v_sc, sc_salaires, '2026-07-01', -9750, 'manual'),
    (v_user_id, v_sc, sc_salaires, '2026-08-01', -9750, 'manual'),
    -- Loyer
    (v_user_id, v_sc, sc_loyer, '2026-03-01', -1800, 'manual'),
    (v_user_id, v_sc, sc_loyer, '2026-04-01', -1800, 'manual'),
    (v_user_id, v_sc, sc_loyer, '2026-05-01', -1800, 'manual'),
    (v_user_id, v_sc, sc_loyer, '2026-06-01', -1800, 'manual'),
    (v_user_id, v_sc, sc_loyer, '2026-07-01', -1800, 'manual'),
    (v_user_id, v_sc, sc_loyer, '2026-08-01', -1800, 'manual');

  -- ============================================
  -- 5. INVOICES
  -- ============================================

  -- ChaussuresPro invoices
  INSERT INTO invoices (user_id, company_id, type, partner_name, invoice_number, invoice_date, due_date, amount_ht, amount_ttc, vat_amount, status, source, paid_at) VALUES
    (v_user_id, v_cp, 'receivable', 'Galeries Lafayette', 'FA-2025-087', '2025-11-15', '2025-12-15', 8500, 10200, 1700, 'paid', 'manual', '2025-12-10'),
    (v_user_id, v_cp, 'receivable', 'Le Bon Marche', 'FA-2025-092', '2025-12-01', '2026-01-01', 6200, 7440, 1240, 'paid', 'manual', '2025-12-28'),
    (v_user_id, v_cp, 'receivable', 'Printemps Haussmann', 'FA-2026-003', '2026-01-10', '2026-02-10', 4800, 5760, 960, 'pending', 'manual', NULL),
    (v_user_id, v_cp, 'receivable', 'BHV Marais', 'FA-2026-008', '2026-02-01', '2026-03-01', 3500, 4200, 700, 'pending', 'manual', NULL),
    (v_user_id, v_cp, 'payable', 'Nike France', 'NF-2025-4521', '2025-10-15', '2025-12-01', 15000, 18000, 3000, 'paid', 'manual', '2025-11-28'),
    (v_user_id, v_cp, 'payable', 'Adidas Distribution', 'AD-2025-891', '2025-11-20', '2026-01-05', 7900, 9480, 1580, 'overdue', 'manual', NULL),
    (v_user_id, v_cp, 'payable', 'Bata France', 'BF-2026-112', '2026-01-05', '2026-02-20', 10400, 12480, 2080, 'pending', 'manual', NULL),
    (v_user_id, v_cp, 'payable', 'Puma Europe', 'PE-2026-045', '2026-01-25', '2026-03-10', 6000, 7200, 1200, 'pending', 'manual', NULL);

  -- CloudSoft invoices
  INSERT INTO invoices (user_id, company_id, type, partner_name, invoice_number, invoice_date, due_date, amount_ht, amount_ttc, vat_amount, status, source, paid_at) VALUES
    (v_user_id, v_cs, 'receivable', 'TechCorp SAS', 'CS-2025-120', '2025-12-01', '2025-12-31', 4950, 5940, 990, 'paid', 'manual', '2025-12-20'),
    (v_user_id, v_cs, 'receivable', 'Airbus Defence', 'CS-2025-125', '2025-12-15', '2026-01-15', 8500, 10200, 1700, 'paid', 'manual', '2026-01-10'),
    (v_user_id, v_cs, 'receivable', 'BNP Paribas IT', 'CS-2026-005', '2026-01-15', '2026-02-15', 12000, 14400, 2400, 'pending', 'manual', NULL),
    (v_user_id, v_cs, 'receivable', 'SmartRetail SAS', 'CS-2026-010', '2026-02-01', '2026-03-01', 3960, 4752, 792, 'pending', 'manual', NULL),
    (v_user_id, v_cs, 'receivable', 'DataFlow SARL', 'CS-2026-012', '2026-02-01', '2026-03-01', 2970, 3564, 594, 'pending', 'manual', NULL),
    (v_user_id, v_cs, 'payable', 'Amazon Web Services', 'AWS-2026-01', '2026-01-31', '2026-02-28', 1450, 1740, 290, 'pending', 'manual', NULL),
    (v_user_id, v_cs, 'payable', 'WeWork France', 'WW-2026-02', '2026-02-01', '2026-02-15', 800, 960, 160, 'pending', 'manual', NULL),
    (v_user_id, v_cs, 'payable', 'GitHub Inc', 'GH-2025-Q4', '2025-10-15', '2025-11-15', 210, 210, 0, 'overdue', 'manual', NULL);

  -- StrategiaConseil invoices
  INSERT INTO invoices (user_id, company_id, type, partner_name, invoice_number, invoice_date, due_date, amount_ht, amount_ttc, vat_amount, status, source, paid_at) VALUES
    (v_user_id, v_sc, 'receivable', 'Carrefour Group', 'SC-2025-045', '2025-09-30', '2025-11-15', 15000, 18000, 3000, 'paid', 'manual', '2025-11-10'),
    (v_user_id, v_sc, 'receivable', 'L''Oreal Paris', 'SC-2025-052', '2025-10-31', '2025-12-15', 22000, 26400, 4400, 'paid', 'manual', '2025-12-12'),
    (v_user_id, v_sc, 'receivable', 'TotalEnergies SE', 'SC-2025-060', '2025-12-31', '2026-02-15', 25000, 30000, 5000, 'overdue', 'manual', NULL),
    (v_user_id, v_sc, 'receivable', 'Renault Group', 'SC-2026-003', '2026-01-31', '2026-03-15', 18000, 21600, 3600, 'pending', 'manual', NULL),
    (v_user_id, v_sc, 'receivable', 'Thales DMS', 'SC-2026-005', '2026-01-31', '2026-03-15', 5500, 6600, 1100, 'pending', 'manual', NULL),
    (v_user_id, v_sc, 'receivable', 'Michelin', 'SC-2026-008', '2026-02-10', '2026-03-25', 14000, 16800, 2800, 'pending', 'manual', NULL),
    (v_user_id, v_sc, 'payable', 'Consultant Junior Freelance', 'CJF-2025-12', '2025-12-15', '2026-01-15', 4500, 5400, 900, 'paid', 'manual', '2026-01-12'),
    (v_user_id, v_sc, 'payable', 'Design UX Studio', 'DUX-2026-01', '2026-01-10', '2026-02-10', 2800, 3360, 560, 'overdue', 'manual', NULL),
    (v_user_id, v_sc, 'payable', 'Data Analytics Pro', 'DAP-2026-02', '2026-02-01', '2026-03-01', 5200, 6240, 1040, 'pending', 'manual', NULL);

END $$;
