import React from 'react';
import { Document, View, Text } from '@react-pdf/renderer';
import { createStyles } from './styles';
import { CoverPage } from './CoverPage';
import { PageWrapper } from './PageWrapper';
import { DataTable } from './DataTable';
import { PnlSection } from './PnlSection';
import { BalanceSheetSection } from './BalanceSheetSection';
import { FundingPlanSection } from './FundingPlanSection';
import { formatCurrency, formatPercent, formatShortDate } from './helpers';
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
  // Data from hooks
  plData: PLData;
  bsData: BalanceSheetData;
  fpData: FundingPlanData;
  cashFlowData: CashFlowData;
  ratios: FinancialRatios;
  getBreakEvenData: (yearIndex: number) => BreakEvenData;
  // Raw data for detail tables
  revenueStreams: any[];
  fixedExpenses: any[];
  variableExpenses: any[];
  personnel: any[];
  directors: any[];
  investments: any[];
  settings: any;
}

export function BPDocument(props: BPDocumentProps) {
  const {
    companyName, sections, introText, primaryColor, startYear, years,
    plData, bsData, fpData, cashFlowData, ratios, getBreakEvenData,
    revenueStreams, fixedExpenses, variableExpenses, personnel, directors, investments, settings,
  } = props;

  const styles = createStyles(primaryColor);
  const has = (s: string) => sections.includes(s);

  // Section title component
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
              ['Effectif salarié', `${personnel.length} personne(s)`],
              ['Investissements totaux', formatCurrency(investments.reduce((s: number, i: any) => s + (i.purchase_amount || 0), 0))],
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
      {has('revenue') && revenueStreams.length > 0 && (
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
          {fixedExpenses.length > 0 && (
            <>
              <SubTitle title="Charges Fixes" />
              <DataTable
                styles={styles}
                headers={['Poste', 'Catégorie', 'Montant/mois', 'Montant annuel']}
                rows={fixedExpenses.map((e: any) => [
                  e.name || '-',
                  e.category || '-',
                  formatCurrency(e.monthly_amount || 0),
                  formatCurrency((e.monthly_amount || 0) * 12),
                ])}
                colWidths={[30, 25, 22, 23]}
                alignRight={[2, 3]}
                totalLabel="Total charges fixes annuelles"
                totalValue={formatCurrency(fixedExpenses.reduce((s: number, e: any) => s + (e.monthly_amount || 0) * 12, 0))}
              />
            </>
          )}
          {variableExpenses.length > 0 && (
            <>
              <SubTitle title="Charges Variables" />
              <DataTable
                styles={styles}
                headers={['Poste', 'Type calcul', 'Valeur', 'Lié à']}
                rows={variableExpenses.map((e: any) => [
                  e.name || '-',
                  e.calculation_type === 'percentage' ? '% du CA' : 'Coût unitaire',
                  e.calculation_type === 'percentage' ? `${e.percentage || 0}%` : formatCurrency(e.unit_cost || 0),
                  e.linked_revenue_stream_id ? 'Flux lié' : 'Global',
                ])}
                colWidths={[30, 25, 22, 23]}
                alignRight={[2]}
              />
            </>
          )}
        </PageWrapper>
      )}

      {/* ═══ PERSONNEL ═══ */}
      {has('personnel') && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Charges de Personnel" />
          {personnel.length > 0 && (
            <>
              <SubTitle title="Salariés" />
              <DataTable
                styles={styles}
                headers={['Poste', 'Embauche', 'Brut mensuel', 'Charges', 'Coût total']}
                rows={personnel.map((p: any) => {
                  const salary = p.gross_salary || 0;
                  const rate = p.employer_charges_rate || 0.45;
                  const charges = salary * (rate > 1 ? rate / 100 : rate);
                  return [
                    p.position || '-',
                    formatShortDate(p.start_date),
                    formatCurrency(salary),
                    `${(rate > 1 ? rate : rate * 100).toFixed(1)}%`,
                    formatCurrency(salary + charges + (p.mutuelle_employer_amount || 0)),
                  ];
                })}
                colWidths={[28, 16, 20, 16, 20]}
                alignRight={[2, 3, 4]}
                totalLabel="Coût annuel total"
                totalValue={formatCurrency(plData.totals.personnelCosts[0] || 0)}
              />
            </>
          )}
          {directors.length > 0 && (
            <>
              <SubTitle title="Dirigeants" />
              <DataTable
                styles={styles}
                headers={['Nom', 'Statut', 'Rémunération', 'Charges', 'Coût total']}
                rows={directors.map((d: any) => {
                  const rem = d.monthly_remuneration || 0;
                  const rate = d.charges_rate || 0.45;
                  const charges = rem * (rate > 1 ? rate / 100 : rate);
                  return [
                    d.name || '-',
                    d.status || '-',
                    formatCurrency(rem),
                    `${(rate > 1 ? rate : rate * 100).toFixed(1)}%`,
                    formatCurrency(rem + charges),
                  ];
                })}
                colWidths={[26, 20, 20, 16, 18]}
                alignRight={[2, 3, 4]}
                totalLabel="Coût annuel total"
                totalValue={formatCurrency(plData.totals.directorsCosts[0] || 0)}
              />
            </>
          )}
        </PageWrapper>
      )}

      {/* ═══ INVESTMENTS ═══ */}
      {has('investments') && investments.length > 0 && (
        <PageWrapper styles={styles} companyName={companyName}>
          <SectionTitle title="Investissements" />
          <DataTable
            styles={styles}
            headers={['Désignation', 'Catégorie', 'Date', 'Montant HT', 'Amort.', 'Dotation/an']}
            rows={investments.map((i: any) => {
              const depYears = i.depreciation_years || 5;
              return [
                i.name || '-',
                i.category || '-',
                formatShortDate(i.purchase_date),
                formatCurrency(i.purchase_amount || 0),
                `${depYears} ans`,
                formatCurrency((i.purchase_amount || 0) / depYears),
              ];
            })}
            colWidths={[24, 16, 14, 18, 12, 16]}
            alignRight={[3, 5]}
            totalLabel="Total investissements"
            totalValue={formatCurrency(investments.reduce((s: number, i: any) => s + (i.purchase_amount || 0), 0))}
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
              // Sum monthly inflows/outflows for this year
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
            headers={['Indicateur', ...plData.years.map(y => y.label)]}
            rows={[
              ['Taux de marge brute', ...ratios.grossMargin.map(v => formatPercent(v))],
              ['Marge opérationnelle', ...ratios.operatingMargin.map(v => formatPercent(v))],
              ['Marge nette', ...ratios.netMargin.map(v => formatPercent(v))],
              ['Ratio de liquidité', ...ratios.currentRatio.map(v => v.toFixed(2))],
              ['Dette / Fonds propres', ...ratios.debtToEquity.map(v => v.toFixed(2))],
              ['Couverture des intérêts', ...ratios.interestCoverage.map(v => v > 100 ? '> 100' : v.toFixed(1))],
            ]}
            colWidths={[40, ...plData.years.map(() => 60 / plData.years.length)]}
            alignRight={plData.years.map((_, i) => i + 1)}
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
