import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import bridgeLogo from '@/assets/bridge-logo.jpg';

const partners = [
  { name: 'Bridge', logo: bridgeLogo },
];

const trustBadges = [
  'DSP2',
  'RGPD',
  'Chiffrement AES-256',
  'Hébergement UE',
];

export function LogoBar() {
  return (
    <section className="py-10 px-4 sm:px-6 lg:px-8 border-b border-border/50">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-5"
        >
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
            Partenaires de confiance
          </p>

          <div className="flex items-center justify-center gap-8 flex-wrap">
            {partners.map((p) => (
              <img
                key={p.name}
                src={p.logo}
                alt={`Logo ${p.name}`}
                className="h-8 object-contain opacity-70 hover:opacity-100 transition-opacity grayscale hover:grayscale-0"
              />
            ))}
            {trustBadges.map((badge) => (
              <Badge key={badge} variant="outline" className="text-xs px-3 py-1">
                {badge}
              </Badge>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
