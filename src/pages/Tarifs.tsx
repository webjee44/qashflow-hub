import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Calendar, Shield, Zap, HeadphonesIcon, Clock, Flame, Users, Award } from 'lucide-react';
import { SEOHead, generateBreadcrumbSchema, generateFAQSchema } from '@/components/seo/SEOHead';
import { useSubscription, PLANS } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

/* ───── FAQ ───── */
const faqs = [
  {
    question: "Comment fonctionne l'essai gratuit de 30 jours ?",
    answer: "Vous pouvez utiliser toutes les fonctionnalités Pro pendant 30 jours sans engagement. Aucune carte bancaire n'est requise pour commencer. À la fin de l'essai, vous pouvez choisir de continuer avec l'abonnement Pro.",
  },
  {
    question: 'Quelle est la différence entre mensuel et annuel ?',
    answer: "L'offre annuelle vous fait économiser 50% : vous payez 594€/an (soit 49,50€/mois) au lieu de 99€/mois. C'est notre meilleure offre, disponible pour une durée limitée.",
  },
  {
    question: 'Puis-je annuler mon abonnement à tout moment ?',
    answer: "Oui, vous pouvez annuler votre abonnement à tout moment depuis votre espace client. Pas de frais cachés ni de période d'engagement.",
  },
  {
    question: 'Y a-t-il une limite sur le nombre de transactions ?',
    answer: 'Non, le plan Pro inclut des transactions illimitées. Vous pouvez synchroniser autant de comptes bancaires que nécessaire.',
  },
  {
    question: 'Les données sont-elles sécurisées ?',
    answer: 'Oui, vos données sont chiffrées avec le standard AES-256 et hébergées en France. Nous sommes conformes au RGPD.',
  },
  {
    question: "Que se passe-t-il à la fin de l'essai gratuit ?",
    answer: "À la fin des 30 jours d'essai, vous pourrez choisir entre l'abonnement mensuel à 99€/mois ou l'offre annuelle à 594€/an (-50%). Vous recevrez un rappel avant la fin de l'essai.",
  },
];

/* ───── component ───── */
export default function Tarifs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: currentPlan, subscribed, is_trialing, createCheckout, checkoutLoading } = useSubscription();
  const [isAnnual, setIsAnnual] = useState(true);


  const handleStartTrial = () => {
    if (!user) { navigate('/sign-up'); return; }
    navigate('/bp/revenus');
    toast.success('Bienvenue ! Votre essai gratuit de 30 jours est actif.');
  };

  const handleSubscribe = async () => {
    if (!user) { navigate('/sign-up'); return; }
    try {
      const priceId = isAnnual ? PLANS.pro.priceIdAnnual : PLANS.pro.priceId;
      await createCheckout(priceId);
    } catch {
      toast.error("Erreur lors de la création du paiement");
    }
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: '/' },
    { name: 'Tarifs', url: '/tarifs' },
  ]);
  const faqSchema = generateFAQSchema(faqs);
  const isCurrentlySubscribed = subscribed || is_trialing;

  const displayPrice = isAnnual ? PLANS.pro.annualMonthlyEquivalent : PLANS.pro.price;
  const displaySuffix = isAnnual ? '/mois facturé annuellement' : '/mois';
  const savings = PLANS.pro.price * 12 - PLANS.pro.annualPrice;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Tarifs - Plan Pro à 99€/mois | Offre Flash -50% annuel"
        description="Essayez qashflow gratuitement pendant 30 jours. Plan Pro à 99€/mois ou 49,50€/mois en annuel (-50%). Sociétés illimitées, Business Plan complet, catégorisation IA."
        keywords="tarifs gestion trésorerie, prix logiciel comptabilité, abonnement business plan, PME startup, essai gratuit"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* ── Flash Banner ── */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground py-2 px-4 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2">
        <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse flex-shrink-0" />
        <span>OFFRE FLASH — Économisez {savings}€/an</span>
        <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse flex-shrink-0" />
      </div>

      {/* ── Navbar ── */}
      <PublicNavbar activePage="tarifs" className="top-9 sm:top-10" />

      {/* ── Hero ── */}
      <section className="pt-28 sm:pt-40 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge variant="secondary" className="mb-6 px-4 py-2">
              <Sparkles className="w-4 h-4 mr-2" />
              30 jours d'essai gratuit • Sans carte bancaire
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Un seul plan,
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                toutes les fonctionnalités
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
              Pas de plans complexes ni de fonctionnalités cachées. Accédez à tout ce dont vous avez besoin pour gérer votre trésorerie.
            </p>
            {/* Social proof */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-8">
              <Users className="w-4 h-4 text-primary" />
              <span>Rejoint par <strong className="text-foreground">+150 entrepreneurs</strong> ce mois-ci</span>
            </div>
          </motion.div>
        </div>
      </section>



      {/* ── Toggle mensuel / annuel ── */}
      <section className="pb-4 px-4">
        <div className="flex items-center justify-center gap-4">
          <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>Mensuel</span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative w-14 h-7 rounded-full transition-colors ${isAnnual ? 'bg-primary' : 'bg-muted-foreground/30'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-background shadow-md transition-transform ${isAnnual ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
            Annuel
          </span>
          <Badge className="bg-destructive text-destructive-foreground text-xs animate-pulse">-50%</Badge>
        </div>
      </section>

      {/* ── Pricing Card ── */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Card className="border-primary shadow-2xl shadow-primary/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/60" />

              {/* Best offer badge */}
              {isAnnual && (
                <div className="absolute -top-0 -right-0">
                  <div className="bg-destructive text-destructive-foreground text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                    MEILLEURE OFFRE
                  </div>
                </div>
              )}

              <CardHeader className="text-center pb-4 pt-8">
                <div className="flex justify-center mb-4">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1">
                    <Calendar className="w-3 h-3 mr-2" />
                    30 jours gratuits
                  </Badge>
                </div>
                <CardTitle className="text-3xl">Plan Pro</CardTitle>
                <CardDescription className="text-base">
                  Tout ce dont vous avez besoin pour votre entreprise
                </CardDescription>
                <div className="mt-6">
                  {isAnnual && (
                    <div className="mb-1">
                      <span className="text-2xl text-muted-foreground line-through">{PLANS.pro.price}€</span>
                    </div>
                  )}
                  <span className="text-5xl font-bold">{displayPrice.toFixed(displayPrice % 1 === 0 ? 0 : 2).replace('.', ',')}€</span>
                  <span className="text-muted-foreground text-lg">{displaySuffix}</span>
                </div>
                {isAnnual && (
                  <p className="text-sm text-destructive font-semibold mt-2">
                    Soit {PLANS.pro.annualPrice}€/an au lieu de {PLANS.pro.price * 12}€ — Vous économisez {savings}€
                  </p>
                )}
                {!isAnnual && (
                  <p className="text-sm text-muted-foreground mt-2">
                    après la période d'essai de 30 jours
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-6 pb-8">
                <ul className="space-y-4">
                  {PLANS.pro.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Scarcity */}
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
                  <p className="text-sm font-semibold text-destructive flex items-center justify-center gap-2">
                    <Flame className="w-4 h-4" />
                    Plus que 12 places à ce tarif
                  </p>
                </div>

                <Button
                  className="w-full h-12 text-lg animate-pulse"
                  size="lg"
                  onClick={isCurrentlySubscribed ? undefined : handleStartTrial}
                  disabled={isCurrentlySubscribed || checkoutLoading}
                >
                  {isCurrentlySubscribed
                    ? 'Vous êtes déjà abonné'
                    : "Commencer l'essai gratuit"}
                </Button>

                {/* Guarantee */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Award className="w-4 h-4 text-primary" />
                  Satisfait ou remboursé 30 jours
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  Sans engagement • Annulable à tout moment
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ── Trust Badges ── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: 'Données sécurisées', desc: 'Chiffrement AES-256, hébergement en France, conforme RGPD' },
              { icon: Zap, title: 'Mise en place rapide', desc: 'Connectez vos comptes bancaires en quelques minutes' },
              { icon: HeadphonesIcon, title: 'Support prioritaire', desc: 'Une équipe dédiée pour répondre à vos questions' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Questions fréquentes</h2>
            <p className="text-muted-foreground">Tout ce que vous devez savoir sur notre offre.</p>
          </motion.div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{faq.question}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl font-bold mb-4">Prêt à simplifier votre gestion ?</h2>
            <p className="text-muted-foreground mb-8">
              Rejoignez les entrepreneurs qui ont choisi qashflow pour piloter leur trésorerie.
            </p>
            <Button size="lg" className="h-12 px-8 animate-pulse" onClick={handleStartTrial} disabled={isCurrentlySubscribed || checkoutLoading}>
              Commencer l'essai gratuit
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Puis {isAnnual ? `${PLANS.pro.annualMonthlyEquivalent.toFixed(2).replace('.', ',')}€/mois (annuel)` : `${PLANS.pro.price}€/mois`} • Annulable à tout moment
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
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
