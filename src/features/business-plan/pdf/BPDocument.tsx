import React from 'react';
import { Document, View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';
import { CoverPage } from './CoverPage';
import { PageWrapper } from './PageWrapper';
import { DataTable } from './DataTable';
import { PnlSection } from './PnlSection';
import { BalanceSheetSection } from './BalanceSheetSection';
import { FundingPlanSection } from './FundingPlanSection';
import { formatCurrency, formatPercent } from './helpers';
import type { PLData } from '../hooks/useProfitLoss';
import type { BalanceSheetData } from '@/hooks/useBalanceSheet';
import type { FundingPlanData } from '../hooks/useFundingPlan';
import type { CashFlowData } from '../hooks/useBPCashFlow';
import type { FinancialRatios, BreakEvenData } from '../hooks/useBPRatios';

export interface BPDocumentProps {
  companyName: string;
  sections: string[];
  introText?: string;
  primaryColor: { r: number; g: number; b: number };
  startYear: number;
  years: number;
  plData: PLData;
  bsData: BalanceSheetData;
  fpData: FundingPlanData;
  cashFlowData: CashFlowData;
  ratios: FinancialRatios;
  getBreakEvenData: (yearIndex: number) => BreakEvenData;
  settings: any;
}

export function BPDocument(props: BPDocumentProps) {
  const {
    companyName, sections, introText, primaryColor, startYear, years,
    plData, bsData, fpData, cashFlowData, ratios, getBreakEvenData, settings,
  } = props;

  const styles = createStyles(primaryColor);
  const has = (s: string) => sections.includes(s);
  const yearLabels = plData.years.map(y => y.label);

  const SectionTitle = ({ title }: { title: string }) => (
    <View style={styles.sectionTitle}>
      <View style={styles.sectionBar} />
      <Text>{title}</Text>
    </View>
  );

  const SubTitle = ({ title }: { title: string }) => (
    <Text style={styles.subsectionTitle}>{title}</Text>
  );

  return (
    <Document>
      {/* ═══ COVER ═══ */}
      {has('cover') && (
        <CoverPage
          styles={styles}
          companyName={companyName}
          introText={introText}
          startYear={startYear}
          years={years}
        />
      )}

      {/* ═══ EXECUTIVE SUMMARY ═══ */}
      {has('executive_summary') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Résumé Exécutif" />
          <Text style={styles.paragraph}>
            Ce document présente le prévisionnel financier de {companyName} sur {years} années,
            de {startYear} à {startYear + years - 1}. Il détaille les hypothèses de revenus,
            la structure de coûts, les investissements prévus et les projections de rentabilité.
          </Text>
          <View style={styles.keyFiguresBox}>
            <Text style={styles.keyFiguresTitle}>CHIFFRES CLÉS</Text>
            {[
              ['CA Année 1', formatCurrency(plData.totals.revenue[0] || 0)],
              [`CA Année ${years}`, formatCurrency(plData.totals.revenue[years - 1] || 0)],
              ['Résultat Net Année 1', formatCurrency(plData.totals.netResult[0] || 0)],
              ['EBE Année 1', formatCurrency(plData.totals.ebitda[0] || 0)],
              ['Charges de personnel Année 1', formatCurrency((plData.totals.personnelCosts[0] || 0) + (plData.totals.directorsCosts[0] || 0))],
              ['Dotations aux amortissements Année 1', formatCurrency(plData.totals.depreciation[0] || 0)],
            ].map(([label, value], i) => (
              <View key={i} style={styles.keyFiguresRow}>
                <Text style={styles.keyFiguresLabel}>{label} :</Text>
                <Text style={styles.keyFiguresValue}>{value}</Text>
              </View>
            ))}
          </View>
        </PageWrapper>
      )}

      {/* ═══ REVENUE ═══ */}
      {has('revenue') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Hypothèses de Revenus" />
          <SubTitle title="Projection du Chiffre d'Affaires" />
          <DataTable
            styles={styles}
            headers={['Année', 'Chiffre d\'affaires', 'Évolution']}
            rows={plData.years.map((y, i) => {
              const rev = plData.totals.revenue[i] || 0;
              const prevRev = i > 0 ? (plData.totals.revenue[i - 1] || 0) : 0;
              let evolution = '-';
              if (i > 0 && prevRev > 0) evolution = ((rev - prevRev) / prevRev * 100).toFixed(1) + '%';
              return [y.label, formatCurrency(rev), evolution];
            })}
            colWidths={[34, 33, 33]}
            alignRight={[1, 2]}
          />
        </PageWrapper>
      )}

      {/* ═══ EXPENSES ═══ */}
      {has('expenses') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Charges Prévisionnelles" />
          <DataTable
            styles={styles}
            headers={['Rubrique', ...yearLabels]}
            rows={[
              ['Achats de marchandises', ...plData.totals.merchandisePurchases.map(v => formatCurrency(v))],
              ['Variation de stock', ...plData.totals.stockVariation.map(v => formatCurrency(v))],
              ['Services extérieurs', ...plData.totals.externalServices.map(v => formatCurrency(v))],
              ['Charges variables', ...plData.totals.variableExpenses.map(v => formatCurrency(v))],
              ['Charges fixes', ...plData.totals.fixedExpenses.map(v => formatCurrency(v))],
              ['Crédit-bail', ...plData.totals.leaseExpenses.map(v => formatCurrency(v))],
              ['Impôts et taxes', ...plData.totals.taxes.map(v => formatCurrency(v))],
            ].filter(row => row.slice(1).some(v => v !== formatCurrency(0)))}
            colWidths={[40, ...yearLabels.map(() => 60 / yearLabels.length)]}
            alignRight={yearLabels.map((_, i) => i + 1)}
          />
        </PageWrapper>
      )}

      {/* ═══ PERSONNEL ═══ */}
      {has('personnel') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Charges de Personnel" />
          <DataTable
            styles={styles}
            headers={['Rubrique', ...yearLabels]}
            rows={[
              ['Salariés (brut + charges)', ...plData.totals.personnelCosts.map(v => formatCurrency(v))],
              ['Dirigeants (rémun. + charges)', ...plData.totals.directorsCosts.map(v => formatCurrency(v))],
              ['Charges sociales patronales', ...plData.totals.payrollTaxes.map(v => formatCurrency(v))],
              ['Indemnités de départ', ...plData.totals.severancePayments.map(v => formatCurrency(v))],
              ['Total charges de personnel', ...plData.totals.personnel.map(v => formatCurrency(v))],
            ].filter(row => row.slice(1).some(v => v !== formatCurrency(0)))}
            colWidths={[40, ...yearLabels.map(() => 60 / yearLabels.length)]}
            alignRight={yearLabels.map((_, i) => i + 1)}
          />
        </PageWrapper>
      )}

      {/* ═══ INVESTMENTS ═══ */}
      {has('investments') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Investissements" />
          <DataTable
            styles={styles}
            headers={['Rubrique', ...yearLabels]}
            rows={[
              ['Dotations aux amortissements', ...plData.totals.depreciation.map(v => formatCurrency(v))],
            ]}
            colWidths={[40, ...yearLabels.map(() => 60 / yearLabels.length)]}
            alignRight={yearLabels.map((_, i) => i + 1)}
          />
        </PageWrapper>
      )}

      {/* ═══ P&L ═══ */}
      {has('pnl') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Compte de Résultat Prévisionnel" />
          <Text style={{ fontSize: 8, fontStyle: 'italic', color: '#64748b', marginBottom: 6 }}>
            Structuré selon le Plan Comptable Général (PCG) et les Soldes Intermédiaires de Gestion (SIG)
          </Text>
          <PnlSection styles={styles} plData={plData} />
        </PageWrapper>
      )}

      {/* ═══ CASH FLOW ═══ */}
      {has('cash_flow') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Plan de Trésorerie" />
          <View style={styles.keyFiguresBox}>
            <Text style={styles.keyFiguresTitle}>SYNTHÈSE</Text>
            {[
              ['Trésorerie initiale', formatCurrency(settings.initial_cash || 0)],
              ['Solde minimum', formatCurrency(cashFlowData.minBalance)],
              ['Mois en négatif', `${cashFlowData.monthsWithNegativeBalance} mois`],
            ].map(([label, value], i) => (
              <View key={i} style={styles.keyFiguresRow}>
                <Text style={styles.keyFiguresLabel}>{label} :</Text>
                <Text style={styles.keyFiguresValue}>{value}</Text>
              </View>
            ))}
          </View>
          <SubTitle title="Flux de Trésorerie Annuels" />
          <DataTable
            styles={styles}
            headers={['Année', 'Encaissements', 'Décaissements', 'Flux net', 'Tréso. fin']}
            rows={plData.years.map((y, i) => {
              const startIdx = plData.years.slice(0, i).reduce((s, yr) => s + yr.months.length, 0);
              const monthCount = y.months.length;
              const yearInflows = cashFlowData.inflows.slice(startIdx, startIdx + monthCount).reduce((a, b) => a + b, 0);
              const yearOutflows = cashFlowData.outflows.slice(startIdx, startIdx + monthCount).reduce((a, b) => a + b, 0);
              const yearNet = yearInflows - yearOutflows;
              const endBalance = cashFlowData.balance[startIdx + monthCount - 1] || 0;
              return [
                y.label,
                formatCurrency(yearInflows),
                formatCurrency(yearOutflows),
                formatCurrency(yearNet),
                formatCurrency(endBalance),
              ];
            })}
            colWidths={[20, 20, 20, 20, 20]}
            alignRight={[1, 2, 3, 4]}
          />
        </PageWrapper>
      )}

      {/* ═══ BALANCE SHEET ═══ */}
      {has('balance_sheet') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Bilan Prévisionnel" />
          <BalanceSheetSection styles={styles} bsData={bsData} />
        </PageWrapper>
      )}

      {/* ═══ FUNDING PLAN ═══ */}
      {has('funding_plan') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Plan de Financement" />
          <FundingPlanSection styles={styles} fpData={fpData} />
        </PageWrapper>
      )}

      {/* ═══ RATIOS ═══ */}
      {has('ratios') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Indicateurs Financiers" />
          <DataTable
            styles={styles}
            headers={['Indicateur', ...yearLabels]}
            rows={[
              ['Taux de marge brute', ...ratios.grossMargin.map(v => formatPercent(v))],
              ['Marge opérationnelle', ...ratios.operatingMargin.map(v => formatPercent(v))],
              ['Marge nette', ...ratios.netMargin.map(v => formatPercent(v))],
              ['Ratio de liquidité', ...ratios.currentRatio.map(v => v.toFixed(2))],
              ['Dette / Fonds propres', ...ratios.debtToEquity.map(v => v.toFixed(2))],
              ['Couverture des intérêts', ...ratios.interestCoverage.map(v => v > 100 ? '> 100' : v.toFixed(1))],
            ]}
            colWidths={[40, ...yearLabels.map(() => 60 / yearLabels.length)]}
            alignRight={yearLabels.map((_, i) => i + 1)}
          />
          {(() => {
            const be = getBreakEvenData(0);
            return (
              <View style={styles.insightBox}>
                <Text style={styles.insightTitle}>Seuil de Rentabilité — Année 1</Text>
                <Text style={styles.insightText}>
                  Point mort : {formatCurrency(be.breakEvenPoint)} | 
                  Atteint en {be.breakEvenMonths} mois | 
                  Marge de sécurité : {formatPercent(be.safetyMarginPercent)}
                </Text>
              </View>
            );
          })()}
        </PageWrapper>
      )}

      {/* ═══ NOTES ═══ */}
      {has('notes') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Notes et Hypothèses" />
          {[
            `Période de projection : ${years} années (${startYear} - ${startYear + years - 1})`,
            `Régime fiscal : ${settings.tax_regime === 'IS' ? 'Impôt sur les Sociétés' : 'Impôt sur le Revenu'}`,
            `Statut PME : ${settings.is_pme !== false ? 'Oui (taux réduit IS 15% jusqu\'à 42 500€)' : 'Non'}`,
            `Délai de paiement clients : ${settings.customer_payment_delay || 30} jours`,
            `Délai de paiement fournisseurs : ${settings.supplier_payment_delay || 30} jours`,
            `Trésorerie initiale : ${formatCurrency(settings.initial_cash || 0)}`,
          ].map((h, i) => (
            <Text key={i} style={styles.bulletPoint}>• {h}</Text>
          ))}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              Les projections présentées dans ce document sont indicatives et basées sur les hypothèses saisies.
              Elles ne constituent pas un engagement et doivent être régulièrement mises à jour en fonction de
              l'évolution réelle de l'activité.
            </Text>
          </View>
        </PageWrapper>
      )}
    </Document>
  );
}
