import { Zap, CreditCard, Brain, Users } from 'lucide-react';
import { ComparisonPage, ComparisonCriterion, ComparisonAdvantage } from '@/components/comparisons/ComparisonPage';

const criteria: ComparisonCriterion[] = [
  { label: 'Prévisions de trésorerie', qashflow: true, competitor: true },
  { label: 'Synchronisation bancaire automatique', qashflow: true, competitor: true },
  { label: 'Catégorisation par IA', qashflow: true, competitor: true },
  { label: 'Business Plan intégré', qashflow: true, competitor: false },
  { label: 'Scénarios de simulation', qashflow: true, competitor: true },
  { label: 'Export PDF', qashflow: true, competitor: true },
  { label: 'Multi-sociétés', qashflow: true, competitor: true },
  { label: 'Règles d\'automatisation', qashflow: true, competitor: true },
  { label: 'Bilan prévisionnel', qashflow: true, competitor: false },
  { label: 'Plan de financement', qashflow: true, competitor: false },
  { label: 'Adapté aux TPE / PME', qashflow: true, competitor: false },
  { label: 'Tarification', qashflow: 'Licence à vie — 828 €', competitor: 'À partir de 99 €/mois' },
];

const advantages: ComparisonAdvantage[] = [
  {
    title: 'Licence à vie',
    description: 'Un seul paiement au lieu d\'un abonnement mensuel. Économisez des milliers d\'euros sur le long terme.',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    title: 'Business Plan complet',
    description: 'P&L, trésorerie, bilan et plan de financement intégrés. Agicap ne propose pas de prévisionnel financier.',
    icon: <Brain className="w-5 h-5" />,
  },
  {
    title: 'Conçu pour les TPE/PME',
    description: 'Interface simple et tarif accessible. Agicap cible les ETI avec des tarifs en conséquence.',
    icon: <Users className="w-5 h-5" />,
  },
  {
    title: 'Tout-en-un',
    description: 'Trésorerie + Business Plan dans un seul outil, sans modules payants supplémentaires.',
    icon: <Zap className="w-5 h-5" />,
  },
];

export default function QashflowVsAgicap() {
  return (
    <ComparisonPage
      competitorName="Agicap"
      competitorSlug="agicap"
      seoTitle="Qashflow vs Agicap — Comparatif 2026"
      seoDescription="Comparez Qashflow et Agicap : fonctionnalités, tarifs, business plan. Découvrez pourquoi Qashflow est l'alternative idéale à Agicap pour les TPE et PME."
      heroSubtitle="Agicap est le leader du marché, mais est-ce le bon choix pour votre entreprise ? Comparaison détaillée des fonctionnalités et des tarifs."
      criteria={criteria}
      advantages={advantages}
    />
  );
}
