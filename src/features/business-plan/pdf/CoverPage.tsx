import React from 'react';
import { Page, View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';

interface CoverPageProps {
  styles: ReturnType<typeof createStyles>;
  companyName: string;
  introText?: string;
  startYear: number;
  years: number;
  warnings?: string[];
  reconciled?: boolean;
  engineVersion?: string;
}

export function CoverPage({
  styles,
  companyName,
  introText,
  startYear,
  years,
  warnings,
  reconciled,
  engineVersion,
}: CoverPageProps) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.coverBand} />
      <Text style={styles.coverTitle}>BUSINESS PLAN</Text>
      <Text style={styles.coverSubtitle}>Prévisionnel financier — version banquier</Text>

      <View style={styles.coverCompanyBox}>
        <Text style={styles.coverCompanyName}>{companyName}</Text>
      </View>

      <Text style={styles.coverPeriod}>
        Période : {startYear} - {startYear + years - 1} ({years} exercices)
      </Text>

      {reconciled !== undefined && (
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={[styles.badge, reconciled ? styles.badgeOk : styles.badgeKo]}>
            {reconciled ? 'États financiers réconciliés' : 'Écarts de réconciliation détectés'}
          </Text>
          {engineVersion && (
            <Text style={{ fontSize: 7, color: '#94a3b8', marginTop: 4 }}>
              Moteur de calcul v{engineVersion}
            </Text>
          )}
        </View>
      )}

      {introText ? <Text style={styles.coverIntro}>{introText}</Text> : null}

      {warnings && warnings.length > 0 && (
        <View style={styles.warningBox}>
          <Text style={{ ...styles.warningText, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>
            Points d'attention :
          </Text>
          {warnings.map((w, i) => (
            <Text key={i} style={styles.warningText}>• {w}</Text>
          ))}
        </View>
      )}

      <View style={styles.coverConfidential}>
        <Text style={styles.coverConfidentialText}>DOCUMENT CONFIDENTIEL</Text>
        <Text style={styles.coverConfidentialSub}>
          Ce document contient des informations financières prévisionnelles et confidentielles.
        </Text>
      </View>
    </Page>
  );
}
