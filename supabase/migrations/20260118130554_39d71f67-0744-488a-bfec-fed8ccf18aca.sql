-- Add columns for custom payslip-imported values
ALTER TABLE bp_personnel 
ADD COLUMN IF NOT EXISTS mutuelle_employer_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS at_mp_rate NUMERIC(6,5),
ADD COLUMN IF NOT EXISTS employer_charges_rate NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS payslip_imported BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN bp_personnel.mutuelle_employer_amount IS 'Montant réel de la part patronale mutuelle/prévoyance (importé depuis fiche de paie)';
COMMENT ON COLUMN bp_personnel.at_mp_rate IS 'Taux AT/MP réel (importé depuis fiche de paie, ex: 0.0093 pour 0.93%)';
COMMENT ON COLUMN bp_personnel.employer_charges_rate IS 'Taux de charges patronales réel (importé depuis fiche de paie)';
COMMENT ON COLUMN bp_personnel.payslip_imported IS 'Indique si les données proviennent d''une fiche de paie importée';