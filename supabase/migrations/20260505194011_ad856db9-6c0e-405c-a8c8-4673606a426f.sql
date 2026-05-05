
-- Mise à jour des salariés Cloud Vapor d'après registre du personnel et bulletins de paie 2026
UPDATE bp_personnel SET
  name='Frédérique DE JEANSON',
  position='Responsable des opérations',
  gross_salary=3500,
  is_executive=true,
  contract_type='cdi',
  end_date='2026-02-28',
  employer_charges_rate=0.433,
  notes='Sortie effective fév. 2026 (préavis CP versés mars-avr).'
WHERE id='621a4aa7-2e28-4eff-9a19-e782c8678373';

UPDATE bp_personnel SET
  name='Romane BAHL',
  position='Responsable Marketing',
  gross_salary=4166.67,
  is_executive=true,
  contract_type='cdi',
  end_date='2026-04-28',
  employer_charges_rate=0.461,
  notes='Sortie 28/04/2026.'
WHERE id='e80c396f-7892-402d-8d77-e99913099835';

UPDATE bp_personnel SET
  name='Johanny GRÉGOIRE',
  position='Team Leader CSM',
  gross_salary=3500,
  is_executive=true,
  contract_type='cdi',
  end_date='2026-04-07',
  employer_charges_rate=0.456,
  notes='Sortie 07/04/2026.'
WHERE id='7c039b20-aefe-4f44-96ab-cd78329a967c';

UPDATE bp_personnel SET
  name='Safaa AKHAMAL',
  position='Directrice Générale',
  gross_salary=5000,
  is_executive=true,
  contract_type='cdi',
  end_date='2026-03-31',
  employer_charges_rate=0.563,
  notes='Sortie 31/03/2026. Taux patronal élevé (charges déplafonnées cadre).'
WHERE id='c358aa71-4999-40a1-aa31-d1fac86270f4';

UPDATE bp_personnel SET
  name='Emilien ZAWADA',
  position='Chargé de communication',
  gross_salary=2750,
  is_executive=false,
  contract_type='cdi',
  end_date=NULL,
  employer_charges_rate=0.345,
  notes='Actif. Non cadre, réduction Fillon appliquée.'
WHERE id='8a20cdfb-3e10-4c43-8227-7ca8afa44e8f';

UPDATE bp_personnel SET
  name='Christophe DOUCEAU',
  position='Responsable d''entrepôt',
  gross_salary=2750,
  is_executive=false,
  contract_type='cdi',
  end_date=NULL,
  employer_charges_rate=0.359,
  notes='Actif. Non cadre, réduction Fillon appliquée.'
WHERE id='be1a5090-749a-4646-a429-5fe1f3144d0f';
