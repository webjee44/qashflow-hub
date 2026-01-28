-- Add departure management columns to bp_personnel
ALTER TABLE bp_personnel
ADD COLUMN IF NOT EXISTS departure_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS severance_amount NUMERIC DEFAULT NULL;

-- Add check constraint for departure_type values
ALTER TABLE bp_personnel
ADD CONSTRAINT bp_personnel_departure_type_check 
CHECK (departure_type IS NULL OR departure_type IN (
  'resignation',
  'end_of_contract',
  'conventional_termination',
  'economic_dismissal',
  'personal_dismissal',
  'retirement'
));

-- Add comment for documentation
COMMENT ON COLUMN bp_personnel.departure_type IS 'Type of departure: resignation, end_of_contract, conventional_termination, economic_dismissal, personal_dismissal, retirement';
COMMENT ON COLUMN bp_personnel.severance_amount IS 'Gross severance amount in euros (before employer contributions)';