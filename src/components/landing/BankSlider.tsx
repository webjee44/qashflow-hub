import { motion } from 'framer-motion';
import bankCic from '@/assets/banks/cic.png';
import bankCreditAgricole from '@/assets/banks/credit-agricole.png';
import bankSocieteGenerale from '@/assets/banks/societe-generale.png';
import bankBnpParibas from '@/assets/banks/bnp-paribas.png';
import bankLcl from '@/assets/banks/lcl.png';
import bankCaisseEpargne from '@/assets/banks/caisse-epargne.png';
import bankBanquePostale from '@/assets/banks/la-banque-postale.png';

const banks = [
  { name: 'CIC', logo: bankCic },
  { name: 'Crédit Agricole', logo: bankCreditAgricole },
  { name: 'Société Générale', logo: bankSocieteGenerale },
  { name: 'BNP Paribas', logo: bankBnpParibas },
  { name: 'LCL', logo: bankLcl },
  { name: "Caisse d'Épargne", logo: bankCaisseEpargne },
  { name: 'La Banque Postale', logo: bankBanquePostale },
];

interface BankSliderProps {
  /** 'dark' = logos blancs sur fond sombre, 'light' = logos assombris sur fond clair */
  variant?: 'dark' | 'light';
}

export function BankSlider({ variant = 'dark' }: BankSliderProps) {
  const logoFilter = variant === 'light' ? 'brightness-0 opacity-60' : '';

  return (
    <section
      className={`py-10 px-4 sm:px-6 overflow-hidden border-b ${
        variant === 'dark' ? 'border-gray-800/50' : 'border-border/50'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto text-center"
      >
        <p
          className={`text-sm font-medium uppercase tracking-wider mb-6 ${
            variant === 'dark' ? 'text-gray-500' : 'text-muted-foreground'
          }`}
        >
          Compatible avec +350 banques dont
        </p>
        <div className="relative w-full">
          <div className="flex w-max animate-[scroll_20s_linear_infinite] gap-12 sm:gap-16">
            {[...banks, ...banks].map((bank, i) => (
              <img
                key={`${bank.name}-${i}`}
                src={bank.logo}
                alt={`Logo ${bank.name}`}
                className={`h-12 sm:h-14 object-contain shrink-0 ${logoFilter}`}
                title={bank.name}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
