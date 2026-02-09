import React from 'react';
import { Page, View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';
import { formatDate } from './helpers';

interface PageWrapperProps {
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  companyName: string;
}

export function PageWrapper({ children, styles, companyName }: PageWrapperProps) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header} fixed>
        <Text>{companyName}</Text>
        <Text>{formatDate(new Date())}</Text>
      </View>
      {children}
      <View style={styles.footer} fixed>
        <Text>Document confidentiel</Text>
        <Text style={styles.footerCenter} render={({ pageNumber }) => `Page ${pageNumber}`} />
        <Text>qashflow.com</Text>
      </View>
    </Page>
  );
}
