// ============================================================
// Excel export — shared styles
// ============================================================
// Single source for fonts, formats, colors and tab colors.
// ============================================================

import type { Worksheet, Row, Cell } from 'exceljs';

export const FONT_BASE = { name: 'Calibri', size: 10 } as const;
export const FONT_BOLD = { ...FONT_BASE, bold: true } as const;
export const FONT_TITLE = { name: 'Calibri', size: 14, bold: true } as const;

export const FMT_EUR = '#,##0 €;[Red](#,##0 €);"-"';
export const FMT_EUR_DECIMAL = '#,##0.00 €;[Red](#,##0.00 €);"-"';
export const FMT_PCT = '0.0%;[Red]-0.0%;"-"';
export const FMT_INT = '#,##0;[Red](#,##0);"-"';
export const FMT_DATE = 'yyyy-mm-dd';

export const COLOR = {
  headerBg: 'FFE8EEF7',
  totalBg: 'FFF1F1F4',
  subtotalBg: 'FFF7F7F9',
  errorBg: 'FFFDE7E9',
  warningBg: 'FFFFF4E5',
  infoBg: 'FFEAF4FE',
  okBg: 'FFE7F6EC',
} as const;

export const TAB_COLOR = {
  readme: 'FF4F46E5',
  assumptions: 'FF6366F1',
  pl: 'FF0EA5E9',
  cash: 'FF10B981',
  balance: 'FF8B5CF6',
  funding: 'FFF59E0B',
  loans: 'FFEF4444',
  controlsOk: 'FF22C55E',
  controlsKo: 'FFDC2626',
  technical: 'FF6B7280',
} as const;

/** Apply baseline view: frozen 1st row + 1st column, gridlines on. */
export function applyBaseLayout(ws: Worksheet, freezeCol = 1, freezeRow = 1) {
  ws.views = [
    {
      state: 'frozen',
      xSplit: freezeCol,
      ySplit: freezeRow,
      activeCell: 'A1',
    },
  ];
  ws.properties.defaultRowHeight = 16;
}

/** Style a header row (1st row of a table). */
export function styleHeaderRow(row: Row) {
  row.eachCell({ includeEmpty: false }, (cell: Cell) => {
    cell.font = { ...FONT_BOLD };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
  row.height = 22;
}

/** Style a "label" cell on a left column (first column). */
export function styleLabel(cell: Cell, indent = 0, bold = false) {
  cell.font = bold ? { ...FONT_BOLD } : { ...FONT_BASE };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent };
}

/** Style a subtotal/total row. */
export function styleTotalRow(row: Row, variant: 'subtotal' | 'total' = 'total') {
  const bg = variant === 'total' ? COLOR.totalBg : COLOR.subtotalBg;
  row.eachCell({ includeEmpty: false }, (cell: Cell) => {
    cell.font = { ...FONT_BOLD };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    if (variant === 'total') {
      cell.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
    }
  });
}

/** Apply euro number format to a column range. */
export function applyEuroFormat(ws: Worksheet, fromCol: number, toCol: number, fromRow: number, toRow: number) {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getCell(r, c);
      cell.numFmt = FMT_EUR;
      if (cell.font == null) cell.font = { ...FONT_BASE };
    }
  }
}
