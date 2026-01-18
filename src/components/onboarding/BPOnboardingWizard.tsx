import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Rocket, TrendingUp, Building2, Users, PiggyBank, 
  BarChart3, ArrowRight, X, Play, CheckCircle2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBPOnboarding } from '@/hooks/useBPOnboarding';
import { useNavigate } from 'react-router-dom';

const WIZARD_STEPS = [
  {
    icon: TrendingUp,
    title: 'Revenus',
    description: 'Définissez vos sources de revenus et vos projections de ventes',
    route: '/bp/revenus',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
  },
  {
    icon: Building2,
    title: 'Charges',
    description: 'Listez vos charges fixes (loyer, assurances, abonnements...)',
    route: '/bp/charges',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  {
    icon: Users,
    title: 'Équipe',
    description: 'Ajoutez vos salariés et prestataires externes',
    route: '/bp/equipe',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    icon: PiggyBank,
    title: 'Investissements',
    description: 'Renseignez vos achats d\'équipements et immobilisations',
    route: '/bp/investissements',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    icon: BarChart3,
    title: 'Résultats',
    description: 'Visualisez votre compte de résultat et trésorerie',
    route: '/bp/pnl',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
  },
];

export function BPOnboardingWizard() {
  const navigate = useNavigate();
  const { shouldShowWizard, dismissWizard, startTour } = useBPOnboarding();
  const [showDetails, setShowDetails] = useState(false);

  if (!shouldShowWizard) return null;

  const handleStartQuick = () => {
    dismissWizard();
    navigate('/bp/revenus');
  };

  const handleStartGuided = () => {
    dismissWizard();
    localStorage.setItem('show-bp-onboarding-tour', 'true');
    navigate('/bp/revenus');
    // Small delay to let navigation complete
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleGoToStep = (route: string) => {
    dismissWizard();
    navigate(route);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-2xl"
        >
          <Card className="relative overflow-hidden border-2 border-primary/20">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <button
              onClick={dismissWizard}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>

            <CardContent className="p-8 relative">
              {!showDetails ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center space-y-6"
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
                    <Rocket className="h-8 w-8 text-primary" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">
                      Bienvenue dans votre Business Plan !
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Créez votre prévisionnel financier en quelques étapes. 
                      Nous allons vous guider pour configurer vos revenus, charges et équipe.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => setShowDetails(true)}
                    >
                      <Sparkles className="h-4 w-4" />
                      Voir les étapes
                    </Button>
                    <Button
                      className="gap-2"
                      onClick={handleStartGuided}
                    >
                      <Play className="h-4 w-4" />
                      Démarrer la visite guidée
                    </Button>
                  </div>

                  <button
                    onClick={handleStartQuick}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Je connais déjà, passer directement →
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">Les étapes de votre Business Plan</h2>
                      <p className="text-sm text-muted-foreground">
                        Cliquez sur une étape pour commencer
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDetails(false)}
                    >
                      Retour
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {WIZARD_STEPS.map((step, index) => (
                      <motion.button
                        key={step.title}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => handleGoToStep(step.route)}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-all group text-left"
                      >
                        <div className={`p-3 rounded-lg ${step.bgColor}`}>
                          <step.icon className={`h-5 w-5 ${step.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium">
                              Étape {index + 1}
                            </span>
                          </div>
                          <p className="font-medium">{step.title}</p>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </motion.button>
                    ))}
                  </div>

                  <div className="flex justify-center pt-4">
                    <Button
                      className="gap-2"
                      onClick={handleStartGuided}
                    >
                      <Play className="h-4 w-4" />
                      Visite guidée complète
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
