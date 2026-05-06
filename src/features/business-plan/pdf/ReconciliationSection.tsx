import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';
import type { ValidationReport } from '../engine/validateBPModel';

interface ReconciliationSectionProps {
  styles: ReturnType<typeof createStyles>;
  report: ValidationReport;
}

const SEVERITY_LABEL: Record<string, string> = {
  error: 'Anomalie',
  warning: 'Avertissement',
  info: 'Information',
};

function fmtDelta(d?: number): string {
  if (d === undefined || d === null || !Number.isFinite(d)) return '—';
  const abs = Math.abs(d);
  return `${d < 0 ? '−' : ''}${abs.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
}

export function ReconciliationSection({ styles, report }: ReconciliationSectionProps) {
  const { ok, summary, issues, engineVersion } = report;
  return (
    <View>
      <View style={[styles.keyFiguresBox, ok ? styles.reconcileOkBox : styles.reconcileKoBox]}>
        <Text style={styles.keyFiguresTitle}>
          {ok ? 'États financiers réconciliés' : 'Écarts de réconciliation détectés'}
        </Text>
        <View style={styles.keyFiguresRow}>
          <Text style={styles.keyFiguresLabel}>Anomalies bloquantes :</Text>
          <Text style={styles.keyFiguresValue}>{summary.errors}</Text>
        </View>
        <View style={styles.keyFiguresRow}>
          <Text style={styles.keyFiguresLabel}>Avertissements :</Text>
          <Text style={styles.keyFiguresValue}>{summary.warnings}</Text>
        </View>
        <View style={styles.keyFiguresRow}>
          <Text style={styles.keyFiguresLabel}>Informations :</Text>
          <Text style={styles.keyFiguresValue}>{summary.infos}</Text>
        </View>
        <View style={styles.keyFiguresRow}>
          <Text style={styles.keyFiguresLabel}>Version du moteur :</Text>
          <Text style={styles.keyFiguresValue}>{engineVersion}</Text>
        </View>
      </View>

      {issues.length === 0 ? (
        <Text style={styles.paragraph}>
          Aucun écart détecté entre le compte de résultat, le bilan, le plan de trésorerie et le
          plan de financement. Tous les invariants comptables vérifiés sont satisfaits dans la
          tolérance retenue (1 € ou 0,1 % de la valeur de référence).
        </Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Code</Text>
            <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Sévérité</Text>
            <Text style={[styles.tableHeaderCell, { width: '50%' }]}>Description</Text>
            <Text style={[styles.tableHeaderCell, { width: '15%', textAlign: 'right' }]}>Écart</Text>
          </View>
          {issues.map((issue, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: '20%' }]}>{issue.code}</Text>
              <Text style={[styles.tableCell, { width: '15%' }]}>{SEVERITY_LABEL[issue.severity] || issue.severity}</Text>
              <Text style={[styles.tableCell, { width: '50%' }]}>{issue.message}</Text>
              <Text style={[styles.tableCellRight, { width: '15%' }]}>{fmtDelta(issue.delta)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.paragraph, { fontSize: 7, color: '#64748b', marginTop: 8 }]}>
        Méthode : chaque invariant compare deux agrégats issus de modules indépendants (P&L, cash
        flow, bilan, plan de financement). Tolérance appliquée : max(1 €, 0,1 % de la valeur de
        référence). Les anomalies bloquantes nécessitent une correction des données saisies avant
        présentation à un tiers financier.
      </Text>
    </View>
  );
}
