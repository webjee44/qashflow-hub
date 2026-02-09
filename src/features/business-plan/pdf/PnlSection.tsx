import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';
import type { PLData } from '../hooks/useProfitLoss';
import { formatCurrency } from './helpers';

interface PnlSectionProps {
  styles: ReturnType<typeof createStyles>;
  plData: PLData;
}

export function PnlSection({ styles, plData }: PnlSectionProps) {
  const yearLabels = plData.years.map(y => y.label);
  const labelWidth = '45%';
  const colWidth = `${55 / yearLabels.length}%`;

  const getRowStyle = (type: string) => {
    switch (type) {
      case 'header': return styles.pnlHeaderRow;
      case 'subtotal': return styles.pnlSubtotalRow;
      case 'sig': return styles.pnlSigRow;
      case 'total': return styles.pnlTotalRow;
      default: return styles.tableRow;
    }
  };

  const getCellStyle = (type: string, isLabel: boolean) => {
    if (type === 'total') return styles.pnlTotalCell;
    if (type === 'header') return styles.pnlHeaderCell;
    if (type === 'subtotal' || type === 'sig') return { ...styles.tableCell, fontFamily: 'Helvetica-Bold' as const };
    return isLabel ? styles.tableCell : styles.tableCellRight;
  };

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        <Text style={{ ...styles.tableHeaderCell, width: labelWidth }}>Rubrique</Text>
        {yearLabels.map((y, i) => (
          <Text key={i} style={{ ...styles.tableHeaderCell, width: colWidth, textAlign: 'center' }}>{y}</Text>
        ))}
      </View>

      {/* Rows */}
      {plData.rows.map((row, ri) => (
        <View key={ri} style={getRowStyle(row.type)} wrap={false}>
          <Text style={{
            ...getCellStyle(row.type, true),
            width: labelWidth,
            paddingLeft: (row.indent || 0) * 8,
          }}>
            {row.label}
          </Text>
          {row.values.length > 0 ? row.values.map((v, vi) => (
            <Text key={vi} style={{
              ...getCellStyle(row.type, false),
              width: colWidth,
              textAlign: 'right',
              color: row.type === 'total' ? 'white' : (v < 0 ? '#dc2626' : undefined),
            }}>
              {formatCurrency(v)}
            </Text>
          )) : yearLabels.map((_, vi) => (
            <Text key={vi} style={{ ...getCellStyle(row.type, false), width: colWidth }} />
          ))}
        </View>
      ))}
    </View>
  );
}
