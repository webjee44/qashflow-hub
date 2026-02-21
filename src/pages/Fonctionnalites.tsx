import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Check,
  Wallet,
  TrendingUp,
  Bot,
  LineChart,
  Shield,
  Users,
  BarChart3,
  PiggyBank,
  FileText,
  Zap,
  Calculator,
  Target,
  Layers,
  Building2,
  Receipt,
  Briefcase,
  Download,
  History,
  Trash2,
  Sparkles,
  RefreshCcw,
  Globe,
  Link2,
  CreditCard,
} from 'lucide-react';
import { SEOHead, generateBreadcrumbSchema } from '@/components/seo/SEOHead';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import logo from '@/assets/logo.png';

const featureCategories = [
  {
    title: "Trésorerie",
    description: "Suivez et anticipez votre cash en temps réel",
    features: [
      {
        icon: Wallet,
        title: 'Synchronisation bancaire',
        slug: 'synchronisation-bancaire',
        description: 'Connectez tous vos comptes bancaires professionnels via Bridge API.',
        details: [
          'Connexion à plus de 350 banques françaises',
          'Synchronisation automatique quotidienne',
          'Agrégation multi-comptes temps réel',
          'Historique complet des transactions',
        ],
      },
      {
        icon: Bot,
        title: 'Catégorisation IA',
        slug: 'categorisation-ia',
        description: "L'IA catégorise automatiquement vos transactions avec précision.",
        details: [
          'Apprentissage sur vos données',
          'Précision de 95%+',
          'Suggestions intelligentes',
          'Règles d\'automatisation personnalisées',
        ],
      },
      {
        icon: Sparkles,
        title: 'Automatisations IA',
        slug: 'automatisations',
        description: 'Créez des règles intelligentes pour automatiser la gestion de vos flux.',
        details: [
          'Règles conditionnelles multi-critères',
          'Catégorisation automatique par règle',
          'Statistiques d\'application en temps réel',
          'Application rétroactive sur l\'historique',
        ],
      },
      {
        icon: LineChart,
        title: 'Prévisions cash-flow',
        slug: 'previsions-tresorerie',
        description: 'Anticipez vos besoins de trésorerie sur 12 mois avec réconciliation bancaire.',
        details: [
          'Projections basées sur l\'historique',
          'Réconciliation automatique sur solde bancaire réel',
          'Comparaison budget vs réel',
          'Export des prévisions',
        ],
      },
      {
        icon: Receipt,
        title: 'Engagements & Créances',
        slug: 'engagements',
        description: 'Suivez vos factures clients et fournisseurs en un seul endroit.',
        details: [
          'Import automatique depuis Pennylane ou Odoo',
          'Suivi des échéances et relances',
          'Statistiques par statut (payé, en attente, en retard)',
          'Connecteurs comptables configurables',
        ],
      },
      {
        icon: Building2,
        title: 'Multi-sociétés & Organisations',
        slug: 'multi-societes',
        description: 'Gérez toutes vos structures depuis un seul compte.',
        details: [
          'Consolidation instantanée multi-entités',
          'Basculement rapide entre sociétés',
          'Organisations multi-membres',
          'Données cloisonnées par structure',
        ],
      },
    ],
  },
  {
    title: "Business Plan",
    description: "Créez des projections financières professionnelles",
    features: [
      {
        icon: TrendingUp,
        title: 'Hypothèses de revenus',
        slug: 'revenus',
        description: 'Modélisez vos sources de revenus avec différents modèles.',
        details: [
          'Modèles : abonnement, vente unitaire, forfait',
          'Taux de croissance par année',
          'Taux de churn et créances douteuses',
          'Prévisions mensuelles automatiques',
        ],
      },
      {
        icon: CreditCard,
        title: 'Gestion des charges',
        slug: 'charges',
        description: 'Charges fixes et variables liées à vos revenus.',
        details: [
          'Charges fixes avec fréquence de paiement',
          'Charges variables liées aux revenus',
          'Gestion TVA déductible',
          'Catégorisation PCG',
        ],
      },
      {
        icon: Briefcase,
        title: 'Équipe & Masse salariale',
        slug: 'equipe',
        description: 'Gérez salariés, dirigeants et freelances.',
        details: [
          'Calcul automatique des charges patronales',
          'Import de bulletins de paie',
          'Primes et bonus par employé',
          'Freelances et TJM',
        ],
      },
      {
        icon: Layers,
        title: 'Investissements & Amortissements',
        slug: 'investissements',
        description: 'Planifiez vos investissements et leur amortissement.',
        details: [
          'Amortissement linéaire/dégressif',
          'Durée configurable (1-20 ans)',
          'Catégorisation des immobilisations',
          'Impact automatique sur le bilan',
        ],
      },
      {
        icon: PiggyBank,
        title: 'Financements',
        slug: 'financements',
        description: 'Emprunts, apports en capital et subventions.',
        details: [
          'Emprunts avec échéancier automatique',
          'Apports en capital',
          'Subventions et aides',
          'Comptes courants d\'associés',
        ],
      },
      {
        icon: Layers,
        title: 'Stocks',
        slug: 'stocks',
        description: 'Gérez vos stocks et leur impact sur le BFR.',
        details: [
          'Stock initial et final par exercice',
          'Achats de marchandises',
          'Variation de stocks automatique',
          'Impact sur le besoin en fonds de roulement',
        ],
      },
    ],
  },
  {
    title: "Analyses & Rapports",
    description: "Tableaux financiers et indicateurs clés",
    features: [
      {
        icon: Calculator,
        title: 'Compte de résultat',
        slug: 'compte-resultat',
        description: 'P&L prévisionnel automatique sur plusieurs années.',
        details: [
          'Chiffre d\'affaires et marge brute',
          'EBE, résultat d\'exploitation',
          'Résultat net après IS',
          'Vue mensuelle et annuelle',
        ],
      },
      {
        icon: BarChart3,
        title: 'Plan de trésorerie',
        slug: 'plan-tresorerie',
        description: 'Flux de trésorerie détaillés mois par mois.',
        details: [
          'Encaissements et décaissements',
          'Délais de paiement clients/fournisseurs',
          'Solde de trésorerie prévisionnel',
          'Alertes de trésorerie négative',
        ],
      },
      {
        icon: FileText,
        title: 'Bilan prévisionnel',
        slug: 'bilan',
        description: 'Actif et passif calculés automatiquement.',
        details: [
          'Immobilisations nettes',
          'BFR et créances/dettes',
          'Capitaux propres',
          'Équilibre automatique',
        ],
      },
      {
        icon: Wallet,
        title: 'Plan de financement',
        slug: 'plan-financement',
        description: 'Vue consolidée des besoins et ressources de financement.',
        details: [
          'Besoins durables vs ressources durables',
          'Capacité d\'autofinancement',
          'Variation du BFR',
          'Trésorerie nette prévisionnelle',
        ],
      },
      {
        icon: Target,
        title: 'Ratios & Indicateurs',
        slug: 'ratios',
        description: 'KPIs financiers essentiels en un coup d\'œil.',
        details: [
          'Seuil de rentabilité',
          'Marge brute et nette',
          'BFR en jours de CA',
          'Capacité d\'autofinancement',
        ],
      },
    ],
  },
  {
    title: "Scénarios & Collaboration",
    description: "Comparez et travaillez en équipe",
    features: [
      {
        icon: RefreshCcw,
        title: 'Scénarios multiples',
        slug: 'scenarios',
        description: 'Créez des scénarios optimiste, réaliste et pessimiste.',
        details: [
          'Multiplicateurs revenus/charges',
          'Overrides par élément',
          'Comparaison graphique',
          'Duplication de scénarios',
        ],
      },
      {
        icon: History,
        title: 'Snapshots & Historique',
        slug: 'snapshots',
        description: 'Sauvegardez des versions de votre BP.',
        details: [
          'Création de snapshots',
          'Comparaison entre versions',
          'Restauration possible',
          'Historique des modifications',
        ],
      },
      {
        icon: Download,
        title: 'Export PDF professionnel',
        slug: 'export',
        description: 'Générez un BP complet pour vos investisseurs.',
        details: [
          'Export PDF multi-pages',
          'Tous les tableaux financiers',
          'Graphiques inclus',
          'Personnalisation logo',
        ],
      },
      {
        icon: Users,
        title: 'Multi-utilisateurs',
        slug: 'collaboration',
        description: 'Invitez votre équipe avec des rôles granulaires.',
        details: [
          'Rôles : Owner, Admin, Membre, Viewer',
          'Invitations par email',
          'Journal d\'audit complet',
          'Permissions par entreprise',
        ],
      },
    ],
  },
  {
    title: "Sécurité & Conformité",
    description: "Vos données protégées aux standards bancaires",
    features: [
      {
        icon: Shield,
        title: 'Sécurité bancaire',
        slug: 'securite',
        description: 'Chiffrement et protection de niveau bancaire.',
        details: [
          'Chiffrement AES-256',
          'Synchronisation DSP2',
          'Serveurs hébergés en Union Européenne',
          'Audit de sécurité régulier',
        ],
      },
      {
        icon: Link2,
        title: 'Connecteurs comptables',
        slug: 'connecteurs',
        description: 'Synchronisez vos données avec votre logiciel comptable.',
        details: [
          'Connecteur Pennylane',
          'Connecteur Odoo',
          'Import automatique des factures',
          'Architecture extensible',
        ],
      },
      {
        icon: Trash2,
        title: 'Corbeille & Récupération',
        slug: 'corbeille',
        description: 'Récupérez vos données supprimées.',
        details: [
          'Soft delete sur toutes les données',
          'Restauration en un clic',
          'Purge après 30 jours',
          'Protection contre les erreurs',
        ],
      },
    ],
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

export default function Fonctionnalites() {
  const navigate = useNavigate();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: '/' },
    { name: 'Fonctionnalités', url: '/fonctionnalites' },
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Fonctionnalités"
        description="Découvrez toutes les fonctionnalités de Qashflow : synchronisation bancaire, business plan, catégorisation IA, automatisations, multi-sociétés et plus."
        keywords="gestion trésorerie, business plan, synchronisation bancaire, catégorisation IA, automatisations, multi-sociétés, PME, startup"
      />
      
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <PublicNavbar activePage="fonctionnalites" className="top-0" />

      {/* Hero */}
      <section className="relative pt-24 sm:pt-32 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(241 86% 58% / 0.1), transparent 70%)',
        }} />
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="mb-6 gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Direction Financière augmentée par l'IA
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Toutes les fonctionnalités pour
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                piloter vos finances
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Trésorerie en temps réel, business plan professionnel, automatisations IA, multi-sociétés et connecteurs comptables.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features by Category */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-20">
          {featureCategories.map((category, categoryIndex) => (
            <motion.div
              key={category.title}
              {...fadeUp}
              transition={{ delay: categoryIndex * 0.1 }}
            >
              <div className="text-center mb-10">
                <Badge variant="outline" className="mb-4">{category.title}</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">{category.title}</h2>
                <p className="text-muted-foreground">{category.description}</p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {category.features.map((feature, i) => (
                  <motion.div
                    key={feature.slug}
                    {...fadeUp}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="h-full glass-card hover:shadow-xl hover:border-primary/20 transition-all" id={feature.slug}>
                      <CardHeader className="pb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                          <feature.icon className="w-5 h-5 text-primary" />
                        </div>
                        <CardTitle className="text-lg">{feature.title}</CardTitle>
                        <CardDescription className="text-sm">
                          {feature.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-1.5">
                          {feature.details.map((detail, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Prêt à piloter votre rentabilité en temps réel ?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Essayez Qashflow gratuitement pendant 30 jours, sans carte bancaire.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/sign-up')}>
              Démarrer mon essai gratuit
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/tarifs">Voir les tarifs</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div>
              <h3 className="font-semibold mb-4">Produit</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/fonctionnalites" className="hover:text-foreground">Fonctionnalités</Link></li>
                <li><Link to="/tarifs" className="hover:text-foreground">Tarifs</Link></li>
                <li><Link to="/fonctionnalites#securite" className="hover:text-foreground">Sécurité</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Entreprise</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/a-propos" className="hover:text-foreground">À propos</Link></li>
                <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Comparatifs</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/comparatifs/qashflow-vs-zenfirst" className="hover:text-foreground">Qashflow vs Zenfirst</Link></li>
                <li><Link to="/comparatifs/qashflow-vs-agicap" className="hover:text-foreground">Qashflow vs Agicap</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Légal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/mentions-legales" className="hover:text-foreground">Mentions légales</Link></li>
                <li><Link to="/confidentialite" className="hover:text-foreground">Confidentialité</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:support@qashflow.fr" className="hover:text-foreground">support@qashflow.fr</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Qashflow - Direction Financière augmentée par l'IA. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
