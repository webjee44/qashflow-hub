import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    q: "J'ai déjà un comptable, pourquoi utiliser Qashflow ?",
    a: "Qashflow ne remplace pas votre comptable. Il vous donne une visibilité en temps réel sur votre trésorerie et vos prévisions, là où la comptabilité vous donne une photo du passé. Les deux sont complémentaires.",
  },
  {
    q: "J'utilise déjà Excel pour mon suivi de trésorerie.",
    a: "Excel est puissant mais chronophage. Qashflow automatise la synchronisation bancaire, la catégorisation et les prévisions. Vous passez de 3h/semaine à 10 minutes.",
  },
  {
    q: 'Est-ce que mes données bancaires sont en sécurité ?',
    a: "Oui. Qashflow utilise Bridge (agréé ACPR Banque de France) pour la connexion bancaire. Vos identifiants ne transitent jamais par nos serveurs. Chiffrement AES-256, hébergement UE, conformité RGPD.",
  },
  {
    q: 'Combien de comptes bancaires puis-je connecter ?',
    a: "Il n'y a pas de limite. Vous pouvez connecter autant de comptes et de banques que nécessaire, y compris des comptes multi-devises.",
  },
  {
    q: "Qu'est-ce que la licence à vie ?",
    a: "Un paiement unique de 828 € (au lieu de 1 656 €) vous donne accès à Qashflow pour toujours, mises à jour incluses. Pas d'abonnement mensuel qui s'accumule.",
  },
  {
    q: 'Puis-je essayer avant de payer ?',
    a: "Bien sûr ! L'essai gratuit de 7 jours est sans engagement et sans carte bancaire. Vous avez accès à toutes les fonctionnalités.",
  },
];

export function LandingFAQ() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Questions fréquentes</h2>
          <p className="text-muted-foreground">
            Les réponses aux questions que vous vous posez avant de vous lancer.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-card rounded-lg border px-4">
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
