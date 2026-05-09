// ============================================================
// Excel export — types
// ============================================================
// Shapes consumed only by the Excel builder. Keep them minimal:
// the builder receives the *already-computed* BPFinancialModel and
// the raw BPModelInput. It never re-fetches, never recalculates.
// ============================================================

export interface ExportMeta {
  companyName: string;
  companyId?: string | null;
  businessPlanId?: string | null;
  exportedAt: Date;
  currency?: string; // default 'EUR'
}
