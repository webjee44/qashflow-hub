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
  Zap
} from 'lucide-react';
import { SEOHead, generateBreadcrumbSchema } from '@/components/seo/SEOHead';
import logo from '@/assets/logo.png';

const features = [
  {
    icon: Wallet,
    title: 'Synchronisation bancaire',
    slug: 'synchronisation-bancaire',
    description: 'Connectez tous vos comptes bancaires professionnels en un clic grâce à Bridge API.',
    details: [
      'Connexion sécurisée à plus de 350 banques françaises',
      'Synchronisation automatique quotidienne',
      'Agrégation multi-comptes en temps réel',
      'Historique complet des transactions',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Business Plan intégré',
    slug: 'business-plan',
    description: 'Créez des projections financières professionnelles avec des scénarios multiples.',
    details: [
      'Compte de résultat prévisionnel',
      'Plan de trésorerie sur 3 ans',
      'Bilan prévisionnel automatique',
      'Export PDF professionnel',
    ],
  },
  {
    icon: Bot,
    title: 'Catégorisation IA',
    slug: 'categorisation-ia',
    description: "L'intelligence artificielle catégorise automatiquement vos transactions.",
    details: [
      'Apprentissage continu sur vos données',
      'Précision de 95% après quelques semaines',
      'Suggestions intelligentes',
      'Règles d\'automatisation personnalisées',
    ],
  },
  {
    icon: LineChart,
    title: 'Prévisions cash-flow',
    slug: 'previsions-tresorerie',
    description: 'Anticipez vos besoins de trésorerie sur 12 mois avec nos algorithmes.',
    details: [
      'Projections basées sur l\'historique',
      'Alertes de trésorerie basse',
      'Scénarios optimiste/pessimiste',
      'Intégration du BFR',
    ],
  },
  {
    icon: Shield,
    title: 'Sécurité bancaire',
    slug: 'securite',
    description: 'Vos données sont chiffrées et sécurisées avec les standards bancaires.',
    details: [
      'Chiffrement AES-256',
      'Hébergement en France',
      'Conformité RGPD',
      'Audit de sécurité régulier',
    ],
  },
  {
    icon: Users,
    title: 'Multi-utilisateurs',
    slug: 'collaboration',
    description: 'Invitez votre équipe et gérez les accès avec des rôles granulaires.',
    details: [
      'Gestion des rôles (Admin, Membre, Viewer)',
      'Invitations par email',
      'Journal d\'audit complet',
      'Permissions par entreprise',
    ],
  },
];

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
        description="Découvrez toutes les fonctionnalités de qashflow : synchronisation bancaire, business plan, catégorisation IA, prévisions cash-flow et plus."
        keywords="gestion trésorerie, business plan, synchronisation bancaire, catégorisation IA, prévisions cash-flow, PME, startup"
      />
      
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="Qashflow" className="h-9" />
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link to="/fonctionnalites" className="text-foreground font-medium">
                Fonctionnalités
              </Link>
              <Link to="/tarifs" className="text-muted-foreground hover:text-foreground transition-colors">
                Tarifs
              </Link>
              <Link to="/a-propos" className="text-muted-foreground hover:text-foreground transition-colors">
                À propos
              </Link>
              <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/sign-in')}>
                Connexion
              </Button>
              <Button onClick={() => navigate('/sign-up')}>
                Essai gratuit
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="mb-6">
              <Zap className="w-3 h-3 mr-1" />
              Suite complète de gestion financière
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Toutes les fonctionnalités pour
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                maîtriser votre trésorerie
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              De la synchronisation bancaire au business plan, découvrez comment qashflow 
              simplifie la gestion financière de votre entreprise.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow" id={feature.slug}>
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
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
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Prêt à optimiser votre gestion financière ?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Essayez qashflow gratuitement pendant 14 jours, sans carte bancaire.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/sign-up')}>
              Démarrer gratuitement
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
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
                <li><Link to="/blog" className="hover:text-foreground">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Légal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/mentions-legales" className="hover:text-foreground">Mentions légales</Link></li>
                <li><Link to="/confidentialite" className="hover:text-foreground">Confidentialité</Link></li>
                <li><Link to="/cgv" className="hover:text-foreground">CGV</Link></li>
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
            © {new Date().getFullYear()} qashflow. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
