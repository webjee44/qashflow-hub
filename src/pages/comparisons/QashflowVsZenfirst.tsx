import { Zap, CreditCard, Brain, BarChart3 } from 'lucide-react';
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
  { label: 'Tarification', qashflow: 'Licence à vie — 499 €', competitor: 'Abonnement mensuel' },
];

const advantages: ComparisonAdvantage[] = [
  {
    title: 'Licence à vie',
    description: 'Un seul paiement, pas d\'abonnement. Accès illimité pour toujours avec toutes les mises à jour incluses.',
    icon: <CreditCard className="w-5 h-5" />,
  },
  {
    title: 'IA intégrée',
    description: 'Catégorisation automatique de vos transactions grâce à l\'intelligence artificielle. Gagnez des heures chaque mois.',
    icon: <Brain className="w-5 h-5" />,
  },
  {
    title: 'Business Plan complet',
    description: 'Créez votre prévisionnel financier complet : P&L, trésorerie, bilan, plan de financement.',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    title: 'Tout-en-un',
    description: 'Trésorerie + Business Plan dans un seul outil. Plus besoin de jongler entre plusieurs logiciels.',
    icon: <Zap className="w-5 h-5" />,
  },
];

export default function QashflowVsZenfirst() {
  return (
    <ComparisonPage
      competitorName="Zenfirst"
      competitorSlug="zenfirst"
      seoTitle="Qashflow vs Zenfirst — Comparatif 2026"
      seoDescription="Comparez Qashflow et Zenfirst : fonctionnalités, tarifs, IA, business plan. Découvrez pourquoi Qashflow est l'alternative idéale à Zenfirst pour piloter votre trésorerie."
      heroSubtitle="Quel outil de gestion de trésorerie choisir ? Comparaison détaillée des fonctionnalités, tarifs et approche pour vous aider à faire le bon choix."
      criteria={criteria}
      advantages={advantages}
    />
  );
}
