/**
 * Re-export du moteur intercompany depuis la source de vérité edge/shared.
 * Cette indirection permet aux tests vitest côté front d'importer
 * la même implémentation que celle utilisée dans l'edge function.
 */
export * from '../../../../supabase/functions/_shared/intercompany/matchIntercompanyTransfers';
