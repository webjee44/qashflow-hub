import { motion } from 'framer-motion';
import { automationRules, categories } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { 
  Zap, 
  Play, 
  Pause, 
  Edit3, 
  Trash2, 
  Plus,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export function AutomationRules() {
  const [rules, setRules] = useState(automationRules);

  const toggleRule = (id: string) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, isActive: !rule.isActive } : rule
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header with AI suggestion */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-gradient-to-r from-accent/10 to-primary/10 rounded-2xl border border-accent/20 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Suggestion IA</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Nous avons détecté 12 transactions similaires qui pourraient être automatisées. 
              Créez une règle pour les catégoriser automatiquement en "Abonnements SaaS".
            </p>
            <div className="flex gap-3 mt-4">
              <Button size="sm" className="gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                Créer la règle
              </Button>
              <Button size="sm" variant="ghost">
                Ignorer
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Rules List */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl border border-border shadow-card"
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Règles d'automatisation</h3>
            <p className="text-sm text-muted-foreground">
              {rules.filter(r => r.isActive).length} règles actives sur {rules.length}
            </p>
          </div>
          <Button className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle règle
          </Button>
        </div>

        <div className="divide-y divide-border">
          {rules.map((rule, index) => (
            <motion.div
              key={rule.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.05 * index }}
              className={cn(
                "p-5 transition-colors",
                rule.isActive ? "bg-card" : "bg-muted/30"
              )}
            >
              <div className="flex items-center gap-4">
                {/* Status Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  rule.isActive 
                    ? "bg-success/10 text-success" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {rule.isActive ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </div>

                {/* Rule Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className={cn(
                      "font-semibold",
                      rule.isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {rule.name}
                    </h4>
                    {rule.isActive && (
                      <Badge className="bg-success/10 text-success border-success/20">
                        Active
                      </Badge>
                    )}
                  </div>
                  
                  {/* Rule Flow */}
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                      {rule.condition}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                      {rule.action}: {rule.category}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => toggleRule(rule.id)}
                  />
                  <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-4"
      >
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">847</p>
              <p className="text-sm text-muted-foreground">Transactions automatisées</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">96%</p>
              <p className="text-sm text-muted-foreground">Précision IA</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Play className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">12h</p>
              <p className="text-sm text-muted-foreground">Temps économisé / mois</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
