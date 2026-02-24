import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, ArrowLeft, Rocket, TrendingUp, PiggyBank, Users } from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function BPIntroDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();

  useEffect(() => {
    if (!currentCompany?.id || !user?.id) return;
    // Check bp_enabled from DB - if already activated, never show
    supabase
      .from('profiles')
      .select('bp_enabled')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.bp_enabled) {
          // Already activated in DB, never show again
          return;
        }
        setOpen(true);
      });
  }, [currentCompany?.id, user?.id]);

  const dismiss = () => {
    setOpen(false);
  };

  const handleActivate = async () => {
    // Persist activation in DB so modal never shows again
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ bp_enabled: true })
        .eq('id', user.id);
      // Also sync localStorage for sidebar/settings
      localStorage.setItem('bp_enabled', 'true');
      window.dispatchEvent(new Event('bp-enabled-changed'));
    }
    dismiss();
  };

  const handleGoBack = () => {
    dismiss();
    navigate('/transactions');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop with blur */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={dismiss} />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header accent */}
            <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-accent" />

            <div className="p-6 space-y-5">
              {/* Icon + Title */}
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Business Plan Prévisionnel</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Construisez votre prévisionnel financier sur 3 ans
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: TrendingUp, label: 'Revenus & charges', desc: 'Projetez vos flux' },
                  { icon: Users, label: 'Équipe & masse salariale', desc: 'Charges auto-calculées' },
                  { icon: PiggyBank, label: 'Investissements', desc: 'Amortissements inclus' },
                  { icon: Rocket, label: 'Scénarios', desc: 'Pessimiste à optimiste' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
                    <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendation */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <span className="text-lg">💡</span>
                <p className="text-sm text-foreground">
                  <span className="font-medium">Recommandé :</span> finalisez d'abord votre suivi de trésorerie (transactions, catégories, prévisions) avant de démarrer votre Business Plan.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1 gap-2" onClick={handleGoBack}>
                  <ArrowLeft className="w-4 h-4" />
                  Revenir à la trésorerie
                </Button>
                <Button className="flex-1 gap-2" onClick={handleActivate}>
                  <Rocket className="w-4 h-4" />
                  Activer le Business Plan
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
