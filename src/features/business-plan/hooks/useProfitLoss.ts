// ============================================================
// useProfitLoss — selector on useBPModel
// ============================================================
// PR 1: legacy hook becomes a thin selector. All P&L computation
// now lives in `engine/computePL.ts` and is shared with the PDF.
// ============================================================

import { useBPModel } from './useBPModel';

export type { PLRow, FiscalYear, PLData } from './useProfitLoss.types';

export function useProfitLoss() {
  const { data: model, isLoading } = useBPModel();
  const data = model.pl;

  const getBreakEvenYear = (): number | null => {
    let cumulative = 0;
    for (let i = 0; i < data.totals.netResult.length; i++) {
      cumulative += data.totals.netResult[i];
      if (cumulative > 0) return i + 1;
    }
    return null;
  };
  const getGrossMargin = (yearIndex: number = 0): number => {
    const revenue = data.totals.revenue[yearIndex] || 0;
    const cogs = data.totals.cogs[yearIndex] || 0;
    return revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
  };
  const getEBITDAMargin = (yearIndex: number = 0): number => {
    const revenue = data.totals.revenue[yearIndex] || 0;
    const ebitda = data.totals.ebitda[yearIndex] || 0;
    return revenue > 0 ? (ebitda / revenue) * 100 : 0;
  };
  const getValueAddedMargin = (yearIndex: number = 0): number => {
    const revenue = data.totals.revenue[yearIndex] || 0;
    const va = data.totals.valueAdded[yearIndex] || 0;
    return revenue > 0 ? (va / revenue) * 100 : 0;
  };

  return { data, isLoading, getBreakEvenYear, getGrossMargin, getEBITDAMargin, getValueAddedMargin };
}
