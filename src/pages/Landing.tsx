import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Check, 
  TrendingUp, 
  Wallet, 
  BarChart3, 
  Zap,
  Shield,
  Users,
  Building2,
  Sparkles,
  ChevronRight,
  Bot,
  LineChart,
  PiggyBank
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';
import logo from '@/assets/logo.png';

const emailSchema = z.string().email('Email invalide');

const features = [
  {
    icon: Wallet,
    title: 'Trésorerie en temps réel',
    description: 'Synchronisez vos comptes bancaires et suivez votre cash en temps réel avec Bridge API.',
  },
  {
    icon: TrendingUp,
    title: 'Business Plan intégré',
    description: 'Créez des projections financières professionnelles avec scénarios multiples.',
  },
  {
    icon: Bot,
    title: 'Catégorisation IA',
    description: 'Laissez l\'IA catégoriser automatiquement vos transactions avec précision.',
  },
  {
    icon: LineChart,
    title: 'Prévisions cash-flow',
    description: 'Anticipez vos besoins de trésorerie sur 12 mois avec nos algorithmes.',
  },
  {
    icon: Shield,
    title: 'Sécurité bancaire',
    description: 'Vos données sont chiffrées et sécurisées avec les standards bancaires.',
  },
  {
    icon: Users,
    title: 'Multi-utilisateurs',
    description: 'Invitez votre équipe et gérez les accès avec des rôles granulaires.',
  },
];

const plans = [
  {
    name: 'Essai gratuit',
    price: '0',
    description: 'Testez pendant 14 jours',
    features: [
      '1 société incluse',
      'Comptes bancaires illimités',
      'Toutes les fonctionnalités',
      'Business Plan complet',
      'Catégorisation IA',
    ],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    name: 'Par société',
    price: '49',
    description: 'Tarif unique et simple',
    features: [
      'Comptes bancaires illimités',
      'Transactions illimitées',
      'Business Plan complet',
      'Catégorisation IA',
      'Export PDF professionnel',
      'Multi-utilisateurs',
      'Support prioritaire',
    ],
    cta: 'Démarrer maintenant',
    popular: true,
  },
];

const testimonials = [
  {
    quote: "qashflow a transformé notre gestion de trésorerie. On gagne 10h par semaine !",
    author: "Marie L.",
    role: "DAF, Startup SaaS",
  },
  {
    quote: "Le business plan intégré nous a permis de lever 2M€ avec des projections solides.",
    author: "Thomas B.",
    role: "CEO, E-commerce",
  },
  {
    quote: "La catégorisation IA est bluffante. Plus besoin de saisie manuelle.",
    author: "Sophie M.",
    role: "Comptable, Cabinet",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGetStarted = async () => {
    if (user) {
      navigate('/');
      return;
    }

    if (!email) {
      navigate('/auth');
      return;
    }

    try {
      emailSchema.parse(email);
      navigate(`/auth?email=${encodeURIComponent(email)}`);
    } catch {
      toast.error('Veuillez entrer un email valide');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img src={logo} alt="Qashflow" className="h-8" />
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Fonctionnalités
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Tarifs
              </a>
              <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">
                Témoignages
              </a>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <Button onClick={() => navigate('/')}>
                  Accéder à l'app
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/auth')}>
                    Connexion
                  </Button>
                  <Button onClick={() => navigate('/auth?mode=signup')}>
                    Essai gratuit
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <Badge variant="secondary" className="mb-6">
              <Sparkles className="w-3 h-3 mr-1" />
              Nouveau : Catégorisation IA incluse
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Pilotez votre trésorerie
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                avec intelligence
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Synchronisez vos banques, anticipez votre cash-flow et créez des business plans 
              professionnels. Tout en un seul outil.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
              <Button size="lg" className="w-full sm:w-auto" onClick={handleGetStarted}>
                Démarrer gratuitement
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              ✓ Gratuit 14 jours &nbsp; ✓ Sans carte bancaire &nbsp; ✓ Annulation facile
            </p>
          </motion.div>

          {/* Hero Image/Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 relative"
          >
            <div className="bg-gradient-to-b from-primary/20 to-transparent absolute inset-0 rounded-2xl blur-3xl -z-10" />
            <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="p-8 bg-gradient-to-br from-card to-muted/30">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Solde actuel', value: '47 850 €', change: '+12%', icon: Wallet },
                    { label: 'Revenus du mois', value: '23 400 €', change: '+8%', icon: TrendingUp },
                    { label: 'Dépenses du mois', value: '18 200 €', change: '-3%', icon: BarChart3 },
                    { label: 'Prévision 90j', value: '52 100 €', change: '+15%', icon: LineChart },
                  ].map((stat, i) => (
                    <div key={i} className="bg-background/80 rounded-lg p-4 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <stat.icon className="w-4 h-4 text-primary" />
                        <span className="text-sm text-muted-foreground">{stat.label}</span>
                      </div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className={`text-sm ${stat.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                        {stat.change} vs mois dernier
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-48 bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-24 h-24 text-primary/30" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Une suite complète pour gérer votre trésorerie et planifier votre croissance.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full bg-card hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Un tarif unique et transparent
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              49€ par société, comptes bancaires illimités. C'est tout.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className={`h-full relative ${plan.popular ? 'border-primary shadow-lg shadow-primary/20' : ''}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        Plus populaire
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">{plan.price}€</span>
                      <span className="text-muted-foreground">
                        {plan.price === '0' ? ' pendant 14 jours' : '/mois/société'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-3">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className="w-full" 
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => navigate('/auth?mode=signup')}
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ils nous font confiance
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Découvrez ce que nos clients disent de qashflow.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="pt-6">
                    <p className="text-lg mb-6 italic">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {testimonial.author[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold">{testimonial.author}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
              <CardContent className="py-12 text-center">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Prêt à reprendre le contrôle de votre trésorerie ?
                </h2>
                <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
                  Rejoignez des centaines d'entreprises qui utilisent qashflow pour piloter leur cash.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button 
                    size="lg" 
                    variant="secondary"
                    onClick={() => navigate('/auth?mode=signup')}
                  >
                    Démarrer gratuitement
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button 
                    size="lg" 
                    variant="ghost" 
                    className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    Voir une démo
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
                  <PiggyBank className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">qashflow</span>
              </div>
              <p className="text-muted-foreground text-sm">
                La solution tout-en-un pour piloter votre trésorerie et planifier votre croissance.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Tarifs</a></li>
                <li><a href="#" className="hover:text-foreground">Intégrations</a></li>
                <li><a href="#" className="hover:text-foreground">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Ressources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
                <li><a href="#" className="hover:text-foreground">Guides</a></li>
                <li><a href="#" className="hover:text-foreground">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Mentions légales</a></li>
                <li><a href="#" className="hover:text-foreground">CGU</a></li>
                <li><a href="#" className="hover:text-foreground">Confidentialité</a></li>
                <li><a href="#" className="hover:text-foreground">Cookies</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} qashflow. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
