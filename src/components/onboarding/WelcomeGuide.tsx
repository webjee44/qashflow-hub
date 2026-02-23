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
  { icon: LayoutDashboard, title: 'Tableau de bord', desc: 'Solde et flux en un coup d\'œil' },
  { icon: ArrowLeftRight, title: 'Transactions', desc: 'Vos opérations bancaires' },
  { icon: TrendingUp, title: 'Prévisions', desc: 'Anticipez votre trésorerie' },
  { icon: Tags, title: 'Catégories', desc: 'Classez vos dépenses' },
  { icon: Sparkles, title: 'IA', desc: 'Catégorisation automatique' },
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

            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                🎉 Bienvenue ! Découvrez vos outils :
              </p>

              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {SECTIONS.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium text-foreground">{title}</span>
                    <span className="text-xs text-muted-foreground">– {desc}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="outline" onClick={dismiss}>
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
