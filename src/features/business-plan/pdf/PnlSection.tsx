import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';
import type { PLData } from '../hooks/useProfitLoss';
import { formatCurrency, formatPercent } from './helpers';

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

  // Pedagogical reading: Year 1 vs last year (typically Year 3)
  const lastIdx = plData.years.length - 1;
  const safePct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
  const t = plData.totals;
  const insight = (() => {
    if (lastIdx < 0) return null;
    const revLast = t.revenue[lastIdx] || 0;
    const rev1 = t.revenue[0] || 0;
    const grossLast = safePct(revLast - (t.cogs[lastIdx] || 0), revLast);
    const gross1 = safePct(rev1 - (t.cogs[0] || 0), rev1);
    const ebeLast = safePct(t.ebitda[lastIdx] || 0, revLast);
    const ebe1 = safePct(t.ebitda[0] || 0, rev1);
    const netLast = safePct(t.netResult[lastIdx] || 0, revLast);
    const net1 = safePct(t.netResult[0] || 0, rev1);
    const caGrowth = rev1 > 0 ? ((revLast - rev1) / rev1) * 100 : 0;
    return {
      yearLastLabel: plData.years[lastIdx].label,
      year1Label: plData.years[0].label,
      revLast, rev1, caGrowth,
      grossLast, gross1,
      ebeLast, ebe1,
      netLast, net1,
      netLastAmount: t.netResult[lastIdx] || 0,
      ebeLastAmount: t.ebitda[lastIdx] || 0,
    };
  })();

  const trendLabel = (a: number, b: number, unit: 'pt' | '%') => {
    const delta = a - b;
    const sign = delta > 0 ? '+' : '';
    const formatted = unit === 'pt'
      ? `${sign}${delta.toFixed(1).replace('.', ',')} pt`
      : `${sign}${delta.toFixed(1).replace('.', ',')} %`;
    return formatted;
  };

  return (
    <View>
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
            {row.values.length > 0 ? row.values.map((v, vi) => {
              const showPct = row.type === 'sig' && row.percentOfRevenue && isFinite(row.percentOfRevenue[vi]);
              return (
                <View key={vi} style={{ width: colWidth, flexDirection: 'column', alignItems: 'flex-end' }}>
                  <Text style={{
                    ...getCellStyle(row.type, false),
                    textAlign: 'right',
                    color: row.type === 'total' ? 'white' : (v < 0 ? '#dc2626' : undefined),
                  }}>
                    {formatCurrency(v)}
                  </Text>
                  {showPct && (
                    <Text style={{
                      fontSize: 7,
                      fontStyle: 'italic',
                      color: '#64748b',
                      textAlign: 'right',
                      marginTop: 1,
                    }}>
                      {formatPercent(row.percentOfRevenue![vi])} du CA
                    </Text>
                  )}
                </View>
              );
            }) : yearLabels.map((_, vi) => (
              <Text key={vi} style={{ ...getCellStyle(row.type, false), width: colWidth }} />
            ))}
          </View>
        ))}
      </View>

      {insight && lastIdx > 0 && (
        <View style={styles.insightBox} wrap={false}>
          <Text style={styles.insightTitle}>Lecture du compte de résultat</Text>
          <Text style={{ fontSize: 8.5, lineHeight: 1.5, color: '#334155' }}>
            Sur {insight.yearLastLabel}, l'entreprise génère {formatCurrency(insight.revLast)} de chiffre d'affaires
            {insight.rev1 > 0 ? ` (${trendLabel(insight.revLast, insight.rev1, '%').replace('+', '+')} vs ${insight.year1Label})` : ''}.
            La marge brute s'établit à {formatPercent(insight.grossLast)} ({trendLabel(insight.grossLast, insight.gross1, 'pt')} vs {insight.year1Label}),
            soit ce qui reste sur 100 € vendus après achats.
            L'EBE de {formatCurrency(insight.ebeLastAmount)} traduit une rentabilité opérationnelle de {formatPercent(insight.ebeLast)}
            ({trendLabel(insight.ebeLast, insight.ebe1, 'pt')}).
            Le résultat net atteint {formatCurrency(insight.netLastAmount)}, soit une marge nette de {formatPercent(insight.netLast)}
            ({trendLabel(insight.netLast, insight.net1, 'pt')} vs {insight.year1Label}).
          </Text>
        </View>
      )}
    </View>
  );
}
