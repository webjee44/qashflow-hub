import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowRight, Sparkles } from 'lucide-react';
import { SEOHead, generateBreadcrumbSchema } from '@/components/seo/SEOHead';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import logo from '@/assets/logo.png';

export interface ComparisonCriterion {
  label: string;
  qashflow: boolean | string;
  competitor: boolean | string;
}

export interface ComparisonAdvantage {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface ComparisonPageProps {
  competitorName: string;
  competitorSlug: string;
  seoTitle: string;
  seoDescription: string;
  heroSubtitle: string;
  criteria: ComparisonCriterion[];
  advantages: ComparisonAdvantage[];
  year?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5 },
  }),
};

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm font-medium text-foreground">{value}</span>;
  }
  return value ? (
    <Check className="w-5 h-5 text-green-500 mx-auto" />
  ) : (
    <X className="w-5 h-5 text-destructive/60 mx-auto" />
  );
}

export function ComparisonPage({
  competitorName,
  competitorSlug,
  seoTitle,
  seoDescription,
  heroSubtitle,
  criteria,
  advantages,
  year = '2026',
}: ComparisonPageProps) {
  const navigate = useNavigate();

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: '/' },
    { name: 'Comparatifs', url: '/comparatifs' },
    { name: `Qashflow vs ${competitorName}`, url: `/comparatifs/qashflow-vs-${competitorSlug}` },
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        keywords={`qashflow, ${competitorName.toLowerCase()}, comparatif, trésorerie, gestion financière, alternative`}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <PublicNavbar />

      {/* ─── Hero ─── */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <Badge variant="secondary" className="mb-4">
              Comparatif {year}
            </Badge>
          </motion.div>
          <motion.h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Qashflow vs {competitorName}
          </motion.h1>
          <motion.p
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            {heroSubtitle}
          </motion.p>
        </div>
      </section>

      {/* ─── Comparison table ─── */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left py-4 px-6 font-semibold">Fonctionnalité</th>
                  <th className="py-4 px-6 font-semibold text-center text-primary">Qashflow</th>
                  <th className="py-4 px-6 font-semibold text-center">{competitorName}</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((c, i) => (
                  <motion.tr
                    key={c.label}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeUp}
                    custom={i}
                  >
                    <td className="py-4 px-6 text-sm">{c.label}</td>
                    <td className="py-4 px-6 text-center">
                      <CellValue value={c.qashflow} />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <CellValue value={c.competitor} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {criteria.map((c, i) => (
              <motion.div
                key={c.label}
                className="rounded-lg border border-border p-4"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <p className="font-medium text-sm mb-3">{c.label}</p>
                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Qashflow</span>
                    <CellValue value={c.qashflow} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{competitorName}</span>
                    <CellValue value={c.competitor} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Key advantages ─── */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-5xl mx-auto py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Pourquoi choisir Qashflow ?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {advantages.map((adv, i) => (
              <motion.div
                key={adv.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="h-full">
                  <CardContent className="pt-6">
                    <div className="mb-4 flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                      {adv.icon}
                    </div>
                    <h3 className="font-semibold mb-2">{adv.title}</h3>
                    <p className="text-sm text-muted-foreground">{adv.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="py-12 text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-4 opacity-80" />
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Prêt à passer à Qashflow ?
              </h2>
              <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
                Essayez gratuitement pendant 30 jours, sans engagement ni carte bancaire.
              </p>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate('/sign-up')}
              >
                Démarrer mon essai gratuit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── Footer ─── */}
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
