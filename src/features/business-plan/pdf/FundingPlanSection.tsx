import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';
import type { FundingPlanData } from '../hooks/useFundingPlan';
import { formatCurrency } from './helpers';

interface FundingPlanSectionProps {
  styles: ReturnType<typeof createStyles>;
  fpData: FundingPlanData;
}

export function FundingPlanSection({ styles, fpData }: FundingPlanSectionProps) {
  const yearLabels = fpData.years;
  const labelWidth = '45%';
  const colWidth = `${55 / yearLabels.length}%`;

  const getRowStyle = (type: string) => {
    switch (type) {
      case 'header': return styles.pnlHeaderRow;
      case 'subtotal': return styles.pnlSubtotalRow;
      case 'total': return styles.pnlTotalRow;
      default: return styles.tableRow;
    }
  };

  const getCellStyle = (type: string) => {
    if (type === 'total') return styles.pnlTotalCell;
    if (type === 'header') return styles.pnlHeaderCell;
    if (type === 'subtotal') return { ...styles.tableCell, fontFamily: 'Helvetica-Bold' as const };
    return styles.tableCell;
  };

  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={{ ...styles.tableHeaderCell, width: labelWidth }}>Rubrique</Text>
        {yearLabels.map((y, i) => (
          <Text key={i} style={{ ...styles.tableHeaderCell, width: colWidth, textAlign: 'center' }}>{y}</Text>
        ))}
      </View>

      {fpData.rows.map((row, ri) => (
        <View key={ri} style={getRowStyle(row.type)} wrap={false}>
          <Text style={{
            ...getCellStyle(row.type),
            width: labelWidth,
            paddingLeft: (row.indent || 0) * 8,
          }}>
            {row.label}
          </Text>
          {row.values.length > 0 ? row.values.map((v, vi) => (
            <Text key={vi} style={{
              ...getCellStyle(row.type),
              width: colWidth,
              textAlign: 'right',
              color: row.type === 'total' ? 'white' : (v < 0 ? '#dc2626' : undefined),
            }}>
              {formatCurrency(v)}
            </Text>
          )) : yearLabels.map((_, vi) => (
            <Text key={vi} style={{ ...getCellStyle(row.type), width: colWidth }} />
          ))}
        </View>
      ))}
    </View>
  );
}
