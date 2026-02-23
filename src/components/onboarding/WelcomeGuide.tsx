import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Tags,
  Sparkles,
  X,
} from 'lucide-react';

const SECTIONS = [
  {
    icon: LayoutDashboard,
    title: 'Tableau de bord',
    description: 'Vue d\'ensemble de votre trésorerie, solde, encaissements et décaissements.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Transactions',
    description: 'Toutes vos opérations bancaires synchronisées automatiquement.',
  },
  {
    icon: TrendingUp,
    title: 'Prévisions',
    description: 'Anticipez votre trésorerie future avec vos factures récurrentes.',
  },
  {
    icon: Tags,
    title: 'Catégorisation',
    description: 'Classez vos flux par catégorie pour mieux comprendre vos dépenses.',
  },
  {
    icon: Sparkles,
    title: 'Automatisations IA',
    description: 'Laissez l\'IA catégoriser automatiquement vos transactions.',
  },
];

export function WelcomeGuide() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('show-welcome-guide') === 'true') {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.removeItem('show-welcome-guide');
    localStorage.setItem('welcome-guide-dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            <CardContent className="pt-6 pb-5">
              <h2 className="text-lg font-semibold text-foreground mb-1">
                🎉 Bienvenue sur Qashflow !
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Voici les sections clés pour piloter votre trésorerie :
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {SECTIONS.map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/60 p-3"
                  >
                    <div className="shrink-0 mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end">
                <Button size="sm" onClick={dismiss}>
                  J'ai compris
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
