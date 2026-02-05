-- ============================================
-- Migration PCG: Ajout colonnes revenue_type et is_operating_grant
-- ============================================

-- 1. Ajouter la colonne revenue_type sur bp_revenue_streams
-- Permet de distinguer les ventes de marchandises (707) de la production vendue (706)
ALTER TABLE bp_revenue_streams 
ADD COLUMN IF NOT EXISTS revenue_type TEXT DEFAULT 'production';

-- Ajouter la contrainte CHECK
ALTER TABLE bp_revenue_streams 
ADD CONSTRAINT bp_revenue_streams_revenue_type_check 
CHECK (revenue_type IN ('merchandise', 'production'));

-- 2. Ajouter la colonne is_operating_grant sur bp_financings
-- Permet de distinguer les subventions d'exploitation (74) des subventions d'investissement
ALTER TABLE bp_financings 
ADD COLUMN IF NOT EXISTS is_operating_grant BOOLEAN DEFAULT true;

-- Commentaires pour documentation
COMMENT ON COLUMN bp_revenue_streams.revenue_type IS 'Type de revenu PCG: merchandise (707) ou production (706)';
COMMENT ON COLUMN bp_financings.is_operating_grant IS 'Si true, subvention d''exploitation (compte 74), sinon subvention d''investissement';