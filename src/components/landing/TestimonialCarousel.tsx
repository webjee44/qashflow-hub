import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const testimonials = [
  {
    name: 'Sophie M.',
    company: 'Agence digitale (12 salariés)',
    quote: 'Un vrai gain de temps ! Je suis passée de 3h par semaine sur Excel à 10 minutes avec Qashflow.',
    initials: 'SM',
  },
  {
    name: 'Thomas R.',
    company: 'E-commerce (PME)',
    quote: 'La catégorisation automatique est bluffante. 98% de mes transactions sont classées sans intervention.',
    initials: 'TR',
  },
  {
    name: 'Marie L.',
    company: 'Cabinet de conseil',
    quote: "Le business plan intégré m'a permis d'obtenir mon financement bancaire du premier coup.",
    initials: 'ML',
  },
  {
    name: 'Pierre D.',
    company: 'Startup SaaS',
    quote: "Enfin une vue consolidée de mes 4 comptes bancaires. Je pilote ma trésorerie sereinement.",
    initials: 'PD',
  },
  {
    name: 'Camille B.',
    company: 'Commerce de détail',
    quote: "La licence à vie, c'est imbattable. Plus de 69€/mois qui partent en fumée chaque mois.",
    initials: 'CB',
  },
];

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-warning text-warning" />
      ))}
    </div>
  );
}

export function TestimonialCarousel() {
  // Duplicate for infinite scroll
  const doubled = [...testimonials, ...testimonials];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ils pilotent leur trésorerie avec Qashflow
          </h2>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <StarRating />
              <span className="font-semibold text-foreground">4.9/5</span>
            </span>
          </div>
        </motion.div>

        {/* Infinite scroll row */}
        <div className="relative">
          <div className="flex gap-6 animate-scroll-left">
            {doubled.map((t, i) => (
              <Card key={i} className="glass-card flex-shrink-0 w-[340px]">
                <CardContent className="pt-6 pb-5 space-y-4">
                  <StarRating />
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                        {t.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold leading-none">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.company}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
