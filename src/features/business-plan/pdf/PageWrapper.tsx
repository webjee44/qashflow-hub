import React from 'react';
import { Page, View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';
import { formatDate } from './helpers';

interface PageWrapperProps {
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  companyName: string;
  documentTitle?: string;
  engineVersion?: string;
}

export function PageWrapper({ children, styles, companyName, documentTitle, engineVersion }: PageWrapperProps) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header} fixed>
        <Text>{documentTitle || `Business Plan — ${companyName}`}</Text>
        <Text>{formatDate(new Date())}</Text>
      </View>
      {children}
      <View style={styles.footer} fixed>
        <Text>{companyName} · Document confidentiel{engineVersion ? ` · moteur v${engineVersion}` : ''}</Text>
        <Text style={styles.footerCenter} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        <Text>qashflow.io</Text>
      </View>
    </Page>
  );
}
