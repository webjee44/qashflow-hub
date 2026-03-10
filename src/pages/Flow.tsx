import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, TrendingUp, RefreshCw, BarChart3, Shield, CheckCircle2, AlertTriangle, Clock, XCircle, Zap, Lock, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SEOHead } from '@/components/seo/SEOHead';
import logo from '@/assets/logo-white.png';
import felixPhoto from '@/assets/felix.png';
import { BankSlider } from '@/components/landing/BankSlider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

// ── Config ────────────────────────────────────────
const TOTAL_LICENSES = 30;
const DEADLINE = '31 mars 2025';


const features = [
  { icon: RefreshCw, title: 'Synchronisation bancaire automatique', desc: 'Vos comptes se mettent à jour toutes les heures. Zéro saisie manuelle.' },
  { icon: TrendingUp, title: 'Prévisions de trésorerie à 12 mois', desc: 'Anticipez les creux, planifiez vos investissements avec confiance.' },
  { icon: BarChart3, title: 'Compte de résultat prévisionnel', desc: 'Votre P&L auto-généré, mis à jour en temps réel.' },
  { icon: Shield, title: 'Catégorisation intelligente', desc: 'L\'IA apprend vos habitudes et catégorise automatiquement vos mouvements.' },
];

const included = [
  'Licence à vie — pas d\'abonnement',
  'Toutes les fonctionnalités actuelles et futures',
  'Comptes bancaires illimités',
  'Jusqu\'à 3 sociétés',
  'Synchronisation bancaire automatique',
  'Prévisions de trésorerie à 12 mois',
  'Support prioritaire',
  'Mises à jour à vie',
];

const faqs = [
  {
    q: 'Et si Qashflow disparaît ?',
    a: 'Qashflow est un produit rentable dès le premier jour. Il n\'a pas besoin de levée de fonds. Et en cas d\'arrêt, vous auriez utilisé l\'outil bien au-delà de la valeur de votre investissement.',
  },
  {
    q: 'C\'est adapté à ma taille d\'entreprise ?',
    a: 'Qashflow est conçu pour les TPE, PME et indépendants. Si vous gérez entre 1 et 3 sociétés et que vous avez besoin de visibilité sur votre trésorerie, c\'est fait pour vous.',
  },
  {
    q: 'Quelle différence avec Agicap ou Pennylane ?',
    a: 'Agicap facture 3 000 à 10 000 €/an et cible les ETI. Pennylane est un outil comptable complet. Qashflow se concentre sur la trésorerie et les prévisions, avec un prix adapté aux petites structures.',
  },
  {
    q: 'J\'ai déjà un comptable / un DAF, pourquoi Qashflow ?',
    a: 'Votre comptable regarde le passé. Qashflow regarde l\'avenir. Les deux sont complémentaires. Vous gagnez en visibilité entre deux bilans.',
  },
];

export default function Flow() {
  const [licensesRemaining] = useState(27);
  const [isLoading, setIsLoading] = useState(false);

  const ctaClick = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-flow-checkout');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de paiement non reçue');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création du paiement');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 selection:bg-emerald-500/30">
      <SEOHead
        title="Offre Flow — Licence à vie Qashflow | 497€"
        description="Offre exclusive réservée aux abonnés Flow. Licence à vie Qashflow à 497€ au lieu de 1 068€/an. 30 places uniquement."
      />

      {/* ── Topbar ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <img src={logo} alt="Qashflow" className="h-10" />
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
            Réservé abonnés Flow
          </Badge>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge className="mb-6 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-sm px-4 py-1.5 hover:bg-emerald-500/10">
              🔒 {licensesRemaining}/{TOTAL_LICENSES} licences restantes
            </Badge>
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
            Vous pilotez encore votre tréso{' '}
            <span className="text-emerald-400">sur Excel ?</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            J'ai perdu du CA fin 2024 parce que je n'avais pas de vision claire sur ma trésorerie.
            Alors j'ai construit l'outil que j'aurais voulu avoir.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={ctaClick}
              className="bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold text-base px-8 h-12"
            >
              Obtenir ma licence à vie — 497 €
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <span className="text-sm text-gray-500">Jusqu'au {DEADLINE} · Satisfait ou remboursé 7j</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Banques compatibles ── */}
      <BankSlider variant="dark" />

      {/* ── Crédibilité ── */}
      <section className="py-16 px-4 sm:px-6 border-y border-gray-800/50">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-4xl mx-auto"
        >
          <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center mb-12">
            {[
              { value: '7', label: 'sociétés dirigées' },
              { value: 'Top 1%', label: 'mondial Lovable' },
              { value: '3h → 10min', label: 'temps gagné / semaine' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-emerald-400">{stat.value}</p>
                <p className="text-sm text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          <motion.blockquote variants={fadeUp} className="relative max-w-2xl mx-auto text-center">
            <img src={felixPhoto} alt="Félix C." className="w-20 h-20 rounded-full object-cover mx-auto mb-4" />
            <p className="text-lg italic text-gray-300 leading-relaxed">
              "Je gère 7 sociétés. Avant Qashflow, je passais 3h par semaine à mettre à jour des fichiers Excel
              qui cassaient un mois sur deux. Aujourd'hui, j'ai une vision claire en 10 minutes."
            </p>
            <footer className="mt-4 text-sm text-gray-500">
              — Félix C., CEO & fondateur de Qashflow
            </footer>
          </motion.blockquote>
        </motion.div>
      </section>

      {/* ── Le Problème ── */}
      <section className="py-20 px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-3xl mx-auto"
        >
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Le problème que vous connaissez <span className="text-emerald-400">trop bien</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Fin 2024, j'ai failli rater un décalage de trésorerie de 47 000 € parce que mon fichier Excel n'était pas à jour. Ça vous parle ?
          </motion.p>

          <motion.div variants={fadeUp} className="space-y-6">
            {[
              { icon: AlertTriangle, color: 'text-amber-400', title: 'Vos données ne sont jamais à jour', desc: 'Vous ouvrez votre fichier et la dernière mise à jour date de 2 semaines.' },
              { icon: XCircle, color: 'text-red-400', title: 'Vos fichiers cassent régulièrement', desc: 'Une formule décalée, une macro corrompue… et votre prévisionnel est faux.' },
              { icon: Clock, color: 'text-orange-400', title: 'Vous décidez à l\'aveugle', desc: 'Embaucher, investir, signer un bail… sans savoir si la tréso va suivre.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 items-start bg-gray-900/50 border border-gray-800/50 rounded-xl p-5">
                <item.icon className={`h-6 w-6 ${item.color} shrink-0 mt-0.5`} />
                <div>
                  <h3 className="font-semibold text-gray-100 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── La Solution ── */}
      <section className="py-20 px-4 sm:px-6 bg-gray-900/30">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-5xl mx-auto"
        >
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold text-center mb-4">
            Ce que Qashflow fait <span className="text-emerald-400">concrètement</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-400 text-center mb-14 max-w-xl mx-auto">
            Un outil simple, puissant, qui remplace votre fichier Excel en 10 minutes.
          </motion.p>

          <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
            {features.map((f) => (
              <div key={f.title} className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-6 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <f.icon className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-100 mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Vidéo démo */}
          <motion.div variants={fadeUp} className="rounded-2xl overflow-hidden border border-gray-800/50 bg-gray-900/40 aspect-video">
            {/* TODO: remplacer VIDEO_EMBED_URL par l'URL embed de la vidéo */}
            <iframe
              src="about:blank"
              data-src="VIDEO_EMBED_URL"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Démo Qashflow"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ── L'Offre ── */}
      <section className="py-20 px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-2xl mx-auto"
        >
          <motion.div variants={fadeUp} className="bg-gradient-to-b from-gray-900 to-gray-900/60 border-2 border-emerald-500/30 rounded-2xl p-8 sm:p-10 text-center relative overflow-hidden">
            {/* Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <Badge className="mb-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
              Offre Flow exclusive
            </Badge>

            <div className="mb-6 relative">
              <p className="text-gray-500 line-through text-lg">1 068 €/an</p>
              <p className="text-5xl sm:text-6xl font-bold text-emerald-400 mt-1">497 €</p>
              <p className="text-gray-400 text-sm mt-1">Paiement unique · Licence à vie</p>
            </div>

            <ul className="text-left space-y-3 mb-8 max-w-sm mx-auto">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mb-6">
              <Badge className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-800">
                🔒 {licensesRemaining}/{TOTAL_LICENSES} licences restantes
              </Badge>
              <p className="text-xs text-gray-500 mt-2">Jusqu'au {DEADLINE}</p>
            </div>

            <Button
              size="lg"
              onClick={ctaClick}
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold text-base px-10 h-13"
            >
              Obtenir ma licence à vie — 497 €
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <div className="flex items-center justify-center gap-4 mt-5 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Paiement sécurisé</span>
              <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> Remboursement 7j</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Garantie ── */}
      <section className="py-16 px-4 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-2xl mx-auto"
        >
          <motion.div variants={fadeUp} className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 sm:p-10 text-center">
            <Shield className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Garantie satisfait ou remboursé — <span className="text-emerald-400">7 jours</span>
            </h2>
            <p className="text-gray-400 leading-relaxed max-w-lg mx-auto mb-4">
              Vous payez, vous testez l'outil avec vos vraies données bancaires.
              Si Qashflow ne vous convient pas, un simple email dans les 7 jours
              et vous êtes remboursé intégralement. Sans justification, sans friction.
            </p>
            <p className="text-sm text-gray-500">
              Zéro risque pour vous. Tout le risque est de notre côté — et on l'assume.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-4 sm:px-6 bg-gray-900/30">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-2xl mx-auto"
        >
          <motion.h2 variants={fadeUp} className="text-3xl font-bold text-center mb-10">
            Questions fréquentes
          </motion.h2>
          <motion.div variants={fadeUp}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="bg-gray-900/60 border border-gray-800/50 rounded-xl px-5">
                  <AccordionTrigger className="text-left text-sm font-medium text-gray-200 hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-gray-400">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="py-20 px-4 sm:px-6 border-t border-gray-800/50">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-2xl mx-auto text-center"
        >
          <motion.div variants={fadeUp}>
            <Zap className="h-8 w-8 text-emerald-400 mx-auto mb-4" />
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-bold mb-4">
            Arrêtez de piloter à l'aveugle.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-gray-400 mb-8 max-w-md mx-auto">
            Rejoignez les dirigeants qui ont repris le contrôle de leur trésorerie.
            Plus que <span className="text-emerald-400 font-semibold">{licensesRemaining} places</span>.
          </motion.p>
          <motion.div variants={fadeUp}>
            <Button
              size="lg"
              onClick={ctaClick}
              className="bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-semibold text-base px-8 h-12"
            >
              Obtenir ma licence à vie — 497 €
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Bottom bar ── */}
      <footer className="py-6 px-4 border-t border-gray-800/50 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} Qashflow · Tous droits réservés
      </footer>
    </div>
  );
}
