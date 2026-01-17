import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Calendar, Shield, Zap, HeadphonesIcon } from 'lucide-react';
import { SEOHead, generateBreadcrumbSchema, generateFAQSchema } from '@/components/seo/SEOHead';
import { useSubscription, PLANS } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

const faqs = [
  {
    question: 'Comment fonctionne l\'essai gratuit de 30 jours ?',
    answer: 'Vous pouvez utiliser toutes les fonctionnalités Pro pendant 30 jours sans engagement. Aucune carte bancaire n\'est requise pour commencer. À la fin de l\'essai, vous pouvez choisir de continuer avec l\'abonnement Pro.',
  },
  {
    question: 'Puis-je annuler mon abonnement à tout moment ?',
    answer: 'Oui, vous pouvez annuler votre abonnement à tout moment depuis votre espace client. Pas de frais cachés ni de période d\'engagement.',
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
    question: 'Que se passe-t-il à la fin de l\'essai gratuit ?',
    answer: 'À la fin des 30 jours d\'essai, votre abonnement passera automatiquement au plan Pro à 49€/mois. Vous recevrez un rappel avant la fin de l\'essai.',
  },
];

export default function Tarifs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: currentPlan, subscribed, is_trialing, createCheckout, checkoutLoading } = useSubscription();

  const handleStartTrial = () => {
    if (!user) {
      navigate('/sign-up');
      return;
    }
    // User is logged in, redirect to dashboard - they already have trial
    navigate('/dashboard');
    toast.success('Bienvenue ! Votre essai gratuit de 30 jours est actif.');
  };

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: '/' },
    { name: 'Tarifs', url: '/tarifs' },
  ]);

  const faqSchema = generateFAQSchema(faqs);

  const isCurrentlySubscribed = subscribed || is_trialing;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Tarifs - Plan Pro à 49€/mois avec 30 jours d'essai gratuit"
        description="Essayez qashflow gratuitement pendant 30 jours. Plan Pro à 49€/mois : sociétés illimitées, Business Plan complet, catégorisation IA. Sans engagement."
        keywords="tarifs gestion trésorerie, prix logiciel comptabilité, abonnement business plan, PME startup, essai gratuit"
      />
      
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="Qashflow" className="h-9" />
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link to="/fonctionnalites" className="text-muted-foreground hover:text-foreground transition-colors">
                Fonctionnalités
              </Link>
              <Link to="/tarifs" className="text-foreground font-medium">
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
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Pas de plans complexes ni de fonctionnalités cachées. 
              Accédez à tout ce dont vous avez besoin pour gérer votre trésorerie.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Card */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="border-primary shadow-2xl shadow-primary/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/60" />
              
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
                  <span className="text-5xl font-bold">{PLANS.pro.price}€</span>
                  <span className="text-muted-foreground text-lg">/mois</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  après la période d'essai de 30 jours
                </p>
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
                
                <Button 
                  className="w-full h-12 text-lg" 
                  size="lg"
                  onClick={handleStartTrial}
                  disabled={isCurrentlySubscribed || checkoutLoading}
                >
                  {isCurrentlySubscribed 
                    ? 'Vous êtes déjà abonné' 
                    : 'Commencer l\'essai gratuit'}
                </Button>
                
                <p className="text-center text-sm text-muted-foreground">
                  Sans engagement • Annulable à tout moment
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Données sécurisées</h3>
              <p className="text-sm text-muted-foreground">
                Chiffrement AES-256, hébergement en France, conforme RGPD
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Mise en place rapide</h3>
              <p className="text-sm text-muted-foreground">
                Connectez vos comptes bancaires en quelques minutes
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <HeadphonesIcon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Support prioritaire</h3>
              <p className="text-sm text-muted-foreground">
                Une équipe dédiée pour répondre à vos questions
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">Questions fréquentes</h2>
            <p className="text-muted-foreground">
              Tout ce que vous devez savoir sur notre offre.
            </p>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
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

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-4">Prêt à simplifier votre gestion ?</h2>
            <p className="text-muted-foreground mb-8">
              Rejoignez les entrepreneurs qui ont choisi qashflow pour piloter leur trésorerie.
            </p>
            <Button size="lg" className="h-12 px-8" onClick={handleStartTrial} disabled={isCurrentlySubscribed || checkoutLoading}>
              Commencer l'essai gratuit
            </Button>
          </motion.div>
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
