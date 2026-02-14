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
  ChevronRight,
  Bot,
  Building2,
  Sparkles,
  Eye,
  Clock,
  AlertTriangle,
  Shield,
  Lock,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { z } from 'zod';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import logo from '@/assets/logo.png';
import screenshotDashboard from '@/assets/screenshot-previsions.png';
import screenshotPnl from '@/assets/screenshot-pnl.png';

const emailSchema = z.string().email('Email invalide');

const plans = [
  {
    name: 'Essai gratuit',
    price: '0',
    suffix: ' pendant 30 jours',
    description: 'Testez toutes les fonctionnalités',
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
    name: 'Licence Lifetime',
    price: '499',
    originalPrice: '1 000',
    suffix: ' paiement unique',
    description: 'Accès à vie, sans abonnement',
    features: [
      'Sociétés illimitées',
      'Comptes bancaires illimités',
      'Transactions illimitées',
      'Business Plan complet',
      'Catégorisation IA',
      'Export PDF professionnel',
      'Multi-utilisateurs',
      'Support prioritaire',
      'Mises à jour incluses à vie',
    ],
    cta: 'Acheter la licence',
    popular: true,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');

  const handleGetStarted = async () => {
    if (user) {
      navigate('/dashboard');
      return;
    }
    if (!email) {
      navigate('/sign-up');
      return;
    }
    try {
      emailSchema.parse(email);
      navigate(`/sign-up?email=${encodeURIComponent(email)}`);
    } catch {
      toast.error('Veuillez entrer un email valide');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <h1 className="sr-only">Qashflow - Direction Financière augmentée par l'IA pour PME et startups</h1>
      <PublicNavbar className="top-0" />

      {/* ─── Section 1 : Hero ─── */}
      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Radial gradient background */}
        <div className="absolute inset-0 -z-10" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, hsl(241 86% 58% / 0.15), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 20%, hsl(270 60% 55% / 0.08), transparent 60%)',
        }} />

        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <Badge variant="secondary" className="mb-6 gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Direction Financière augmentée par l'IA
            </Badge>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-balance">
              Pilotez votre rentabilité{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                en temps réel
              </span>
              , pas votre comptabilité.
            </h2>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              L'IA qui centralise vos banques, anticipe votre cash-flow et décomplexifie la finance.
              Pour une vision claire de toutes vos sociétés, sans ouvrir un seul Excel.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
              <Input
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
              />
              <Button size="lg" className="w-full sm:w-auto whitespace-nowrap" onClick={handleGetStarted}>
                Démarrer mon essai gratuit (30j)
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
              <span>✓ Gratuit 30 jours</span>
              <span>✓ Sans carte bancaire</span>
              <span>✓ Annulation facile</span>
            </p>
          </motion.div>

          {/* Dashboard screenshot in browser frame */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-16 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent rounded-2xl blur-3xl -z-10" />
            <div className="glass-card rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive/80" />
                  <div className="w-3 h-3 rounded-full bg-warning/80" />
                  <div className="w-3 h-3 rounded-full bg-success/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-background/80 px-4 py-1.5 rounded-lg text-sm text-muted-foreground flex items-center gap-2 border border-border/50">
                    <Lock className="w-3.5 h-3.5" />
                    app.qashflow.fr
                  </div>
                </div>
                <div className="w-[52px]" />
              </div>
              <img src={screenshotDashboard} alt="Dashboard Qashflow - Vue trésorerie multi-sociétés" className="w-full h-auto" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Section 2 : Pain Points ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Vous reconnaissez-vous ?</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              { icon: Eye, title: 'Le Brouillard', text: 'Je ne sais jamais combien il me reste vraiment à la fin du mois.' },
              { icon: Clock, title: 'La Corvée', text: 'Je perds des heures à consolider les données de mes 3 sociétés.' },
              { icon: AlertTriangle, title: 'Le Stress', text: 'Mon bilan arrive 6 mois trop tard pour prendre des décisions.' },
            ].map((pain, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <Card className="h-full glass-card hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <pain.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{pain.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground italic">"{pain.text}"</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 3 : Les 3 Piliers ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">La visibilité financière absolue</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Trois piliers pour reprendre le contrôle de vos finances, sans effort.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {/* Pilier 1 */}
            <motion.div {...fadeUp} transition={{ delay: 0 }}>
              <Card className="h-full glass-card hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Visibilité Multi-Entités</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Consolidation instantanée de toutes vos structures. Un seul écran pour votre groupe.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pilier 2 - with AI progress bar */}
            <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
              <Card className="h-full glass-card hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Bot className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Intelligence de Catégorisation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    L'IA apprend de vos flux pour classer vos dépenses. Zéro erreur, zéro oubli.
                  </p>
                  {/* AI progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-muted-foreground">Flux automatisés</span>
                      <span className="font-semibold text-primary">98 %</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        initial={{ width: 0 }}
                        whileInView={{ width: '98%' }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Pilier 3 */}
            <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
              <Card className="h-full glass-card hover:shadow-xl transition-shadow">
                <CardHeader className="pb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <TrendingUp className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Prédictif & Scénarios</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Projetez votre trésorerie à 6 ou 12 mois pour valider vos investissements ou vos recrutements.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Section 4 : Humain + IA ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div {...fadeUp}>
              <Badge variant="secondary" className="mb-4 gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Humain + IA
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                L'outil qui libère votre équipe des tâches ingrates
              </h2>
              <p className="text-lg text-muted-foreground mb-4">
                Qashflow ne remplace pas votre expertise, il automatise la saisie manuelle.
                Redonnez à votre gestionnaire le temps d'analyser plutôt que de copier-coller.
              </p>
              <p className="text-lg font-medium text-foreground">
                Moins de stress administratif, plus de conseil stratégique.
              </p>
            </motion.div>

            <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
              <div className="glass-card rounded-2xl overflow-hidden shadow-xl">
                <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive/80" />
                    <div className="w-3 h-3 rounded-full bg-warning/80" />
                    <div className="w-3 h-3 rounded-full bg-success/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-background/80 px-4 py-1.5 rounded-lg text-sm text-muted-foreground flex items-center gap-2 border border-border/50">
                      <Lock className="w-3.5 h-3.5" />
                      app.qashflow.fr
                    </div>
                  </div>
                  <div className="w-[52px]" />
                </div>
                <img src={screenshotPnl} alt="Compte de résultat Qashflow - Business Plan" className="w-full h-auto" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Section 5 : Réassurance & Sécurité ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Vos données en sécurité absolue</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-8">
            {[
              { icon: Shield, title: 'DSP2', text: 'Synchronisation bancaire sécurisée via la directive européenne DSP2.' },
              { icon: Lock, title: 'Chiffrement AES-256', text: 'Vos données sont cryptées avec le standard de chiffrement le plus élevé.' },
              { icon: Globe, title: 'Hébergement UE', text: 'Serveurs hébergés en Union Européenne, conformes au RGPD.' },
            ].map((item, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <Card className="h-full text-center glass-card">
                  <CardContent className="pt-8 pb-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp} className="text-center">
            <Badge variant="outline" className="text-sm px-4 py-1.5">
              Compatible avec toutes les banques françaises
            </Badge>
          </motion.div>
        </div>
      </section>

      {/* ─── Section 6 : Pricing ─── */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Un tarif unique et transparent</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Essai gratuit 30 jours, puis licence à vie à 499 € au lieu de 1 000 €.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <Card className={`h-full relative ${plan.popular ? 'glass-card border-primary shadow-lg shadow-primary/20' : ''}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Plus populaire</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      {plan.originalPrice && (
                        <div className="mb-1">
                          <span className="text-lg text-muted-foreground line-through">{plan.originalPrice} €</span>
                        </div>
                      )}
                      <span className="text-4xl font-bold">{plan.price} €</span>
                      <span className="text-muted-foreground">{plan.suffix}</span>
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
                      onClick={() => navigate('/sign-up')}
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

      {/* ─── Section 7 : CTA Final ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUp}>
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
              <CardContent className="py-12 text-center">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Prêt à piloter votre rentabilité en temps réel ?
                </h2>
                <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
                  Rejoignez les dirigeants qui utilisent Qashflow comme direction financière augmentée.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button size="lg" variant="secondary" onClick={() => navigate('/sign-up')}>
                    Démarrer mon essai gratuit
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
                    onClick={() => navigate('/contact')}
                  >
                    Nous contacter
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-12 px-4 sm:px-6 lg:px-8" role="contentinfo">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <img src={logo} alt="Qashflow - Direction Financière augmentée" className="h-8" />
              </div>
              <p className="text-muted-foreground text-sm">
                Qashflow, la direction financière augmentée par l'IA pour piloter votre trésorerie et planifier votre croissance.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/fonctionnalites" className="hover:text-foreground">Fonctionnalités</Link></li>
                <li><Link to="/tarifs" className="hover:text-foreground">Tarifs</Link></li>
                <li><Link to="/fonctionnalites#synchronisation-bancaire" className="hover:text-foreground">Synchronisation bancaire</Link></li>
                <li><Link to="/fonctionnalites#business-plan" className="hover:text-foreground">Business Plan</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/a-propos" className="hover:text-foreground">À propos de Qashflow</Link></li>
                <li><Link to="/contact" className="hover:text-foreground">Contact</Link></li>
                <li><a href="mailto:support@qashflow.fr" className="hover:text-foreground">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/mentions-legales" className="hover:text-foreground">Mentions légales</Link></li>
                <li><Link to="/confidentialite" className="hover:text-foreground">Confidentialité</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Qashflow - Direction Financière augmentée par l'IA. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
