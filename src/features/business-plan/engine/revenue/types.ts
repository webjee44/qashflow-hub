// ============================================================
// Revenue model — types (single source of truth)
// ============================================================
// Output contract of `computeRevenue`. Consumed by:
//   - computePL (P&L lines 707/701/706 + COGS % of revenue)
//   - useRevenue selector → Revenue page UI (table + summary card)
//   - PDF / Excel exports
// ============================================================

export type RevenueSource =
  | 'manual_forecast'      // forecast row exists in DB (any value, including 0)
  | 'subscription'         // computed MRR from subscribers × price
  | 'growth_projection'    // year N derived from a year-1 base × compound growth
  | 'empty';               // no data, value is 0

export interface RevenueStreamMetadata {
  mode: 'variable' | 'subscription';
  revenueType: 'merchandise' | 'production' | 'service';
  monthlySources: RevenueSource[]; // length = months.length
  growthRatesApplied: number[];    // length = fiscalYears.length, decimal (0.10 = 10%)
}

export interface RevenueStreamModel {
  monthly: number[];                  // length = months.length
  yearly: number[];                   // length = fiscalYears.length
  metadata: RevenueStreamMetadata;
}

export interface RevenueFiscalYear {
  start: Date;
  end: Date;
  label: string;
  months: Date[];
}

export interface RevenueModel {
  // Time axis — flat list of month starts across the full BP horizon
  months: Date[];
  // 'yyyy-MM' → index in `months` (and in every byStream[id].monthly)
  monthIndex: Record<string, number>;
  // Fiscal year breakdown
  fiscalYears: RevenueFiscalYear[];

  byStream: Record<string, RevenueStreamModel>;
  totals: {
    monthly: number[];
    yearly: number[];
  };
}

export const monthKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};
