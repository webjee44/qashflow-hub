// ============================================================
// serializeBPModel — deterministic snapshot serializer (PR0)
// ============================================================
// Produces a stable, JSON-friendly representation of a BPFinancialModel
// for golden snapshot tests.
//
// Rules:
//   - Excludes `getBreakEvenData` (function, non-serializable).
//   - Excludes `engineVersion` (volatile).
//   - Converts Date instances to "YYYY-MM-DD".
//   - Rounds numbers to 2 decimals (avoids floating-point jitter).
//   - Sorts object keys for stable diffs.
// ============================================================

import type { BPFinancialModel } from '../types';

const EXCLUDED_KEYS = new Set(['getBreakEvenData', 'engineVersion']);

function ymd(d: Date): string {
  // UTC-safe: avoid timezone shifts on serialization
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function round2(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 100) / 100;
}

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return ymd(value);
  if (typeof value === 'number') return round2(value);
  if (typeof value === 'function') return undefined;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>)
      .filter(k => !EXCLUDED_KEYS.has(k))
      .sort();
    for (const k of keys) {
      const v = normalize((value as Record<string, unknown>)[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return value;
}

export function serializeBPModelForSnapshot(
  model: BPFinancialModel
): Record<string, unknown> {
  return normalize(model) as Record<string, unknown>;
}
