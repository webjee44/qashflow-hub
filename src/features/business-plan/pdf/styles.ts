import { StyleSheet } from '@react-pdf/renderer';

export const createStyles = (primaryColor: { r: number; g: number; b: number }) => {
  const primary = `rgb(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b})`;
  const primaryLight = `rgba(${primaryColor.r}, ${primaryColor.g}, ${primaryColor.b}, 0.08)`;

  return StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 9,
      paddingTop: 40,
      paddingBottom: 40,
      paddingHorizontal: 30,
      color: '#1e293b',
    },
    // Header/Footer
    header: {
      position: 'absolute',
      top: 12,
      left: 30,
      right: 30,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7,
      color: '#94a3b8',
      borderBottomWidth: 0.3,
      borderBottomColor: '#e2e8f0',
      paddingBottom: 4,
    },
    footer: {
      position: 'absolute',
      bottom: 12,
      left: 30,
      right: 30,
      flexDirection: 'row',
      justifyContent: 'space-between',
      fontSize: 7,
      color: '#94a3b8',
    },
    footerCenter: {
      textAlign: 'center',
      flex: 1,
    },
    // Cover
    coverBand: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 180,
      backgroundColor: primary,
    },
    coverTitle: {
      fontSize: 32,
      fontFamily: 'Helvetica-Bold',
      color: 'white',
      marginTop: 60,
      marginLeft: 10,
    },
    coverSubtitle: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 6,
      marginLeft: 10,
    },
    coverCompanyBox: {
      marginTop: 50,
      padding: 16,
      backgroundColor: '#f8fafc',
      borderRadius: 4,
      alignItems: 'center',
    },
    coverCompanyName: {
      fontSize: 24,
      fontFamily: 'Helvetica-Bold',
      color: primary,
    },
    coverPeriod: {
      fontSize: 12,
      marginTop: 12,
      textAlign: 'center',
    },
    coverIntro: {
      fontSize: 10,
      marginTop: 14,
      fontStyle: 'italic',
      color: '#64748b',
      lineHeight: 1.5,
    },
    coverConfidential: {
      position: 'absolute',
      bottom: 50,
      left: 30,
      right: 30,
      textAlign: 'center',
    },
    coverConfidentialText: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#dc2626',
    },
    coverConfidentialSub: {
      fontSize: 7,
      color: '#94a3b8',
      marginTop: 4,
    },
    // Section titles
    sectionTitle: {
      fontSize: 16,
      fontFamily: 'Helvetica-Bold',
      color: primary,
      marginBottom: 12,
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionBar: {
      width: 4,
      height: 14,
      backgroundColor: primary,
      marginRight: 8,
    },
    subsectionTitle: {
      fontSize: 12,
      fontFamily: 'Helvetica-Bold',
      color: '#1e293b',
      marginBottom: 8,
      marginTop: 10,
    },
    // Tables
    table: {
      marginBottom: 12,
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: primary,
      paddingVertical: 5,
      paddingHorizontal: 4,
    },
    tableHeaderCell: {
      color: 'white',
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: 4,
      paddingHorizontal: 4,
      borderBottomWidth: 0.3,
      borderBottomColor: '#e2e8f0',
    },
    tableRowAlt: {
      backgroundColor: '#f8fafc',
    },
    tableCell: {
      fontSize: 8,
    },
    tableCellRight: {
      fontSize: 8,
      textAlign: 'right',
    },
    tableTotalRow: {
      flexDirection: 'row',
      paddingVertical: 5,
      paddingHorizontal: 4,
      backgroundColor: '#f1f5f9',
    },
    tableTotalCell: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
    },
    // P&L specific
    pnlHeaderRow: {
      flexDirection: 'row',
      backgroundColor: primaryLight,
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    pnlHeaderCell: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: primary,
    },
    pnlSubtotalRow: {
      flexDirection: 'row',
      backgroundColor: '#f1f5f9',
      paddingVertical: 4,
      paddingHorizontal: 4,
      borderTopWidth: 0.5,
      borderTopColor: '#cbd5e1',
    },
    pnlSigRow: {
      flexDirection: 'row',
      backgroundColor: primaryLight,
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderTopWidth: 0.5,
      borderTopColor: primary,
    },
    pnlTotalRow: {
      flexDirection: 'row',
      backgroundColor: primary,
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    pnlTotalCell: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: 'white',
    },
    // Key figures box
    keyFiguresBox: {
      borderWidth: 0.5,
      borderColor: primary,
      borderRadius: 3,
      backgroundColor: '#f8fafc',
      padding: 10,
      marginBottom: 12,
    },
    keyFiguresTitle: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: primary,
      marginBottom: 6,
    },
    keyFiguresRow: {
      flexDirection: 'row',
      marginBottom: 3,
    },
    keyFiguresLabel: {
      fontSize: 8,
      width: '50%',
    },
    keyFiguresValue: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      width: '50%',
    },
    // Misc
    paragraph: {
      fontSize: 9,
      lineHeight: 1.5,
      marginBottom: 10,
    },
    bulletPoint: {
      fontSize: 9,
      marginBottom: 3,
    },
    warningBox: {
      backgroundColor: '#fef3c7',
      borderRadius: 3,
      padding: 8,
      marginBottom: 10,
    },
    warningText: {
      fontSize: 8,
      color: '#92400e',
    },
    insightBox: {
      backgroundColor: '#f8fafc',
      borderWidth: 0.5,
      borderColor: primary,
      borderRadius: 3,
      padding: 10,
      marginTop: 8,
    },
    insightTitle: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: primary,
      marginBottom: 4,
    },
    insightText: {
      fontSize: 8,
      lineHeight: 1.4,
    },
    disclaimer: {
      backgroundColor: '#f8fafc',
      padding: 10,
      marginTop: 10,
    },
    disclaimerText: {
      fontSize: 8,
      fontStyle: 'italic',
      color: '#64748b',
      lineHeight: 1.4,
    },
    // Two-column layout for balance sheet / funding plan
    twoCol: {
      flexDirection: 'row',
      gap: 10,
    },
    col: {
      flex: 1,
    },
    colHeader: {
      backgroundColor: '#f1f5f9',
      padding: 6,
      marginBottom: 4,
    },
    colHeaderText: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      color: primary,
    },
    balanceBox: {
      padding: 8,
      borderRadius: 3,
      marginTop: 8,
      alignItems: 'center',
    },
    balanceBoxPositive: {
      backgroundColor: '#16a34a',
    },
    balanceBoxNegative: {
      backgroundColor: '#dc2626',
    },
    balanceBoxText: {
      color: 'white',
      fontFamily: 'Helvetica-Bold',
      fontSize: 11,
    },
    reconcileOkBox: {
      borderColor: '#16a34a',
      backgroundColor: '#f0fdf4',
    },
    reconcileKoBox: {
      borderColor: '#dc2626',
      backgroundColor: '#fef2f2',
    },
    badge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 2,
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: 'white',
      alignSelf: 'flex-start',
    },
    badgeOk: { backgroundColor: '#16a34a' },
    badgeKo: { backgroundColor: '#dc2626' },
  });
};
