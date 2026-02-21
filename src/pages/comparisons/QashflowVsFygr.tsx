import { Zap, CreditCard, Brain, LineChart } from 'lucide-react';
import { ComparisonPage, ComparisonCriterion, ComparisonAdvantage } from '@/components/comparisons/ComparisonPage';

const criteria: ComparisonCriterion[] = [
  { label: 'Prévisions de trésorerie', qashflow: true, competitor: true },
  { label: 'Synchronisation bancaire automatique', qashflow: true, competitor: true },
  { label: 'Catégorisation par IA', qashflow: true, competitor: false },
  { label: 'Business Plan intégré', qashflow: true, competitor: false },
  { label: 'Scénarios de simulation', qashflow: true, competitor: true },
  { label: 'Export PDF', qashflow: true, competitor: true },
  { label: 'Multi-sociétés', qashflow: true, competitor: true },
  { label: 'Règles d\'automatisation', qashflow: true, competitor: false },
  { label: 'Bilan prévisionnel', qashflow: true, competitor: false },
  { label: 'Plan de financement', qashflow: true, competitor: false },
  { label: 'Consolidation multi-entités', qashflow: true, competitor: true },
  { label: 'Tarification', qashflow: 'Licence à vie — 499 €', competitor: 'À partir de 59 €/mois' },
];

const advantages: ComparisonAdvantage[] = [
  {
    title: 'Licence à vie',
    description: 'Un seul paiement au lieu d\'un abonnement mensuel. Fygr facture au mois, Qashflow vous libère.',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    title: 'Business Plan complet',
    description: 'P&L, trésorerie, bilan et plan de financement intégrés. Fygr se concentre uniquement sur le suivi de trésorerie.',
    icon: <Brain className="w-5 h-5" />,
  },
  {
    title: 'IA & Automatisation',
    description: 'Catégorisation intelligente et règles d\'automatisation pour gagner du temps. Fygr reste sur de la saisie manuelle.',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    title: 'Prévisionnel financier',
    description: 'Au-delà du simple suivi de trésorerie : bilan, compte de résultat et plan de financement prévisionnels.',
    icon: <LineChart className="w-5 h-5" />,
  },
];

export default function QashflowVsFygr() {
  return (
    <ComparisonPage
      competitorName="Fygr"
      competitorSlug="fygr"
      seoTitle="Qashflow vs Fygr — Comparatif 2026"
      seoDescription="Comparez Qashflow et Fygr : fonctionnalités, tarifs, business plan. Découvrez pourquoi Qashflow est l'alternative idéale à Fygr pour les TPE et PME."
      heroSubtitle="Fygr est un outil de suivi de trésorerie reconnu. Mais Qashflow va plus loin avec le business plan intégré et l'IA. Comparaison détaillée."
      criteria={criteria}
      advantages={advantages}
    />
  );
}
