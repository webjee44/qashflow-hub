import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';

interface DataTableProps {
  styles: ReturnType<typeof createStyles>;
  headers: string[];
  rows: string[][];
  /** Column width percentages — must sum to ~100 */
  colWidths: number[];
  alignRight?: number[];
  totalLabel?: string;
  totalValue?: string;
}

export function DataTable({ styles, headers, rows, colWidths, alignRight = [], totalLabel, totalValue }: DataTableProps) {
  const pct = (i: number) => `${colWidths[i] || 10}%`;
  const isRight = (i: number) => alignRight.includes(i);

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        {headers.map((h, i) => (
          <Text key={i} style={{ ...styles.tableHeaderCell, width: pct(i), textAlign: isRight(i) ? 'right' : 'left' }}>
            {h}
          </Text>
        ))}
      </View>

      {/* Body */}
      {rows.map((row, ri) => (
        <View key={ri} style={[styles.tableRow, ri % 2 === 1 ? styles.tableRowAlt : {}]}>
          {row.map((cell, ci) => (
            <Text key={ci} style={{ ...(isRight(ci) ? styles.tableCellRight : styles.tableCell), width: pct(ci) }}>
              {cell || '-'}
            </Text>
          ))}
        </View>
      ))}

      {/* Total row */}
      {totalLabel && totalValue && (
        <View style={styles.tableTotalRow}>
          <Text style={{ ...styles.tableTotalCell, width: `${colWidths.slice(0, -1).reduce((a, b) => a + b, 0)}%` }}>
            {totalLabel}
          </Text>
          <Text style={{ ...styles.tableTotalCell, width: pct(colWidths.length - 1), textAlign: 'right' }}>
            {totalValue}
          </Text>
        </View>
      )}
    </View>
  );
}
