import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Target, Heart, Rocket, Users, Shield, Award } from 'lucide-react';
import { SEOHead, generateBreadcrumbSchema } from '@/components/seo/SEOHead';
import logo from '@/assets/logo.png';

const values = [
  {
    icon: Target,
    title: 'Simplicité',
    description: 'Nous croyons que la gestion financière doit être accessible à tous, pas uniquement aux experts comptables.',
  },
  {
    icon: Shield,
    title: 'Sécurité',
    description: 'Vos données financières sont précieuses. Nous appliquons les standards les plus stricts pour les protéger.',
  },
  {
    icon: Heart,
    title: 'Proximité',
    description: 'Une équipe à taille humaine, disponible et à l\'écoute de vos besoins. Pas de chatbots, de vraies personnes.',
  },
  {
    icon: Rocket,
    title: 'Innovation',
    description: 'L\'IA au service de votre productivité. Nous automatisons les tâches répétitives pour vous libérer du temps.',
  },
];

const team = [
  {
    name: 'Alexandre Martin',
    role: 'CEO & Co-fondateur',
    bio: 'Ex-CFO startup, 10 ans d\'expérience en finance d\'entreprise.',
  },
  {
    name: 'Sophie Dubois',
    role: 'CTO & Co-fondatrice',
    bio: 'Ingénieure fintech, passionnée par les APIs bancaires.',
  },
  {
    name: 'Thomas Bernard',
    role: 'Head of Product',
    bio: 'Expert UX, obsédé par la simplicité d\'usage.',
  },
];

export default function APropos() {
  const navigate = useNavigate();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: '/' },
    { name: 'À propos', url: '/a-propos' },
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="À propos"
        description="Découvrez l'histoire et l'équipe derrière qashflow. Notre mission : simplifier la gestion de trésorerie pour les PME et startups françaises."
        keywords="à propos qashflow, équipe, mission, valeurs, startup fintech française"
      />
      
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
              <Link to="/fonctionnalites" className="text-muted-foreground hover:text-foreground transition-colors">
                Fonctionnalités
              </Link>
              <Link to="/tarifs" className="text-muted-foreground hover:text-foreground transition-colors">
                Tarifs
              </Link>
              <Link to="/a-propos" className="text-foreground font-medium">
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
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="mb-6">
              <Award className="w-3 h-3 mr-1" />
              Startup française
            </Badge>
            
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Notre mission : simplifier
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                la vie des entrepreneurs
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Nous avons créé qashflow parce que nous avons vécu la frustration de gérer 
              une trésorerie avec des outils inadaptés. Notre solution est née de ce constat.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-6 text-center">Notre histoire</h2>
            <div className="prose prose-lg dark:prose-invert mx-auto">
              <p>
                En 2023, après avoir accompagné des dizaines de startups dans leur gestion financière, 
                nous avons fait un constat : les outils existants étaient soit trop complexes, soit trop limités.
              </p>
              <p>
                Les DAF passaient des heures sur Excel, les entrepreneurs jonglaient entre 5 applications différentes, 
                et personne n'avait une vision claire de sa trésorerie à 6 mois.
              </p>
              <p>
                Nous avons décidé de créer l'outil que nous aurions aimé avoir : simple, puissant, et intelligent. 
                qashflow est né de cette ambition.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">Nos valeurs</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Les principes qui guident chaque décision que nous prenons.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full text-center">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <value.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">L'équipe</h2>
            <p className="text-muted-foreground">
              Des passionnés de finance et de technologie à votre service.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {team.map((member, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">{member.name}</h3>
                    <p className="text-primary text-sm mb-2">{member.role}</p>
                    <p className="text-sm text-muted-foreground">{member.bio}</p>
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
          <h2 className="text-3xl font-bold mb-4">
            Rejoignez l'aventure qashflow
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Essayez gratuitement et découvrez comment nous pouvons vous aider.
          </p>
          <Button size="lg" onClick={() => navigate('/sign-up')}>
            Démarrer gratuitement
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
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
            © {new Date().getFullYear()} qashflow. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
