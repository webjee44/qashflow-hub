// ============================================================
// buildFiscalYears — single source of truth for the BP time axis
// ============================================================
// Construit la liste des exercices fiscaux du Business Plan.
//
// Règle métier (France) :
//   - Le 1er exercice peut durer entre 1 et 24 mois (premier exercice long
//     pour les sociétés créées en cours d'année).
//   - Les exercices suivants sont calendaires (12 mois pleins).
//
// Si `firstFiscalYearEndDate` est fourni, il définit la fin de Y1.
// Sinon, fallback historique : Y1 = exercice calendaire (12 mois) basé sur
// `fiscal_year_start_month/day`.
// ============================================================

import { addMonths, format, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Format a fiscal year label including its real period.
 * Examples:
 *   "Année 1 (sept. 2025 → août 2026)"
 *   "Année 1 (sept. 2025 → févr. 2027, 18 mois)"  // long first year
 */
export function formatFiscalYearLabel(
  index: number,
  start: Date,
  end: Date,
  monthCount: number,
): string {
  const startStr = format(start, 'LLL yyyy', { locale: fr });
  const endStr = format(end, 'LLL yyyy', { locale: fr });
  const isLong = monthCount > 12;
  const period = isLong
    ? `${startStr} → ${endStr}, ${monthCount} mois`
    : `${startStr} → ${endStr}`;
  return `Année ${index + 1} (${period})`;
}

export interface FiscalYear {
  start: Date;
  end: Date;
  label: string;
  months: Date[];
  monthCount: number;
  isLongFirstYear: boolean;
}

export interface BuildFiscalYearsInput {
  bpStartDate: Date;
  bpYears: number;
  fiscalYearStartMonth: number; // 1-12
  fiscalYearStartDay: number;   // 1-31
  firstFiscalYearEndDate: Date | null;
}

function buildMonths(start: Date, end: Date): Date[] {
  const months: Date[] = [];
  let cursor = startOfMonth(start);
  const lastMonth = startOfMonth(end);
  while (cursor <= lastMonth) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

export function buildFiscalYears(input: BuildFiscalYearsInput): FiscalYear[] {
  const { bpStartDate, bpYears, fiscalYearStartMonth, fiscalYearStartDay, firstFiscalYearEndDate } = input;
  const numYears = Math.max(1, bpYears || 3);

  // Start of Y1 = bpStartDate (or its calendar fiscal anchor for legacy fallback)
  let y1Start: Date;
  let y1End: Date;

  if (firstFiscalYearEndDate) {
    // Premier exercice long explicite
    y1Start = new Date(bpStartDate);
    y1End = new Date(firstFiscalYearEndDate);
  } else {
    // Fallback historique : exercice calendaire 12 mois aligné sur fiscal_year_start_month
    y1Start = new Date(bpStartDate.getFullYear(), fiscalYearStartMonth - 1, fiscalYearStartDay);
    if (y1Start > bpStartDate) {
      y1Start = new Date(bpStartDate.getFullYear() - 1, fiscalYearStartMonth - 1, fiscalYearStartDay);
    }
    y1End = new Date(y1Start);
    y1End.setFullYear(y1End.getFullYear() + 1);
    y1End.setDate(y1End.getDate() - 1);
  }

  const years: FiscalYear[] = [];
  const y1Months = buildMonths(y1Start, y1End);
  years.push({
    start: y1Start,
    end: y1End,
    label: 'Année 1',
    months: y1Months,
    monthCount: y1Months.length,
    isLongFirstYear: y1Months.length > 12,
  });

  // Années suivantes : 12 mois calendaires pleins, démarrant le lendemain de la fin précédente
  for (let i = 1; i < numYears; i++) {
    const prev = years[i - 1];
    const start = new Date(prev.end);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
    const months = buildMonths(start, end);
    years.push({
      start,
      end,
      label: `Année ${i + 1}`,
      months,
      monthCount: months.length,
      isLongFirstYear: false,
    });
  }

  return years;
}
