import React from 'react';
import { Page, View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';

interface CoverPageProps {
  styles: ReturnType<typeof createStyles>;
  companyName: string;
  introText?: string;
  startYear: number;
  years: number;
  // Champs internes conservés pour compat de signature, non rendus dans le PDF banquier.
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

      {introText ? <Text style={styles.coverIntro}>{introText}</Text> : null}

      <View style={styles.coverConfidential}>
        <Text style={styles.coverConfidentialText}>DOCUMENT CONFIDENTIEL</Text>
        <Text style={styles.coverConfidentialSub}>
          Ce document contient des informations financières prévisionnelles et confidentielles.
        </Text>
      </View>
    </Page>
  );
}
