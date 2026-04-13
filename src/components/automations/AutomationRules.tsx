import { useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Zap, 
  Play, 
  Pause, 
  Edit3, 
  Trash2, 
  Plus,
  Sparkles,
  ArrowRight,
  Loader2,
  Euro,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAutomationRules, AutomationRule, RuleCondition } from '@/hooks/useAutomationRules';
import { CreateRuleDialog } from './CreateRuleDialog';
import { EditRuleDialog } from './EditRuleDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const operatorLabels: Record<string, string> = {
  contains: 'contient',
  starts_with: 'commence par',
  ends_with: 'se termine par',
  equals: '=',
  greater_than: '>',
  less_than: '<',
  between: 'entre',
};

const fieldLabels: Record<string, string> = {
  description: 'Description',
  amount: 'Montant',
  source: 'Source',
  type: 'Type',
  bank_account_name: 'Compte bancaire',
};

export function AutomationRules() {
  const { rules, categories, loading, stats, createRule, createCategory, updateRule, toggleRule, deleteRule } = useAutomationRules();
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [decategorizeOnDelete, setDecategorizeOnDelete] = useState(false);
  const [search, setSearch] = useState('');

  const filteredRules = useMemo(() => {
    if (!search.trim()) return rules;
    const q = search.toLowerCase();
    return rules.filter(r => 
      r.name.toLowerCase().includes(q) ||
      r.category?.name?.toLowerCase().includes(q) ||
      r.condition_value.toLowerCase().includes(q) ||
      r.conditions?.some(c => c.condition_value.toLowerCase().includes(q))
    );
  }, [rules, search]);

  const formatCondition = (condition: RuleCondition) => {
    const field = fieldLabels[condition.condition_field] || condition.condition_field;
    const operator = operatorLabels[condition.condition_operator] || condition.condition_operator;
    
    if (condition.condition_field === 'amount') {
      return `${field} ${operator} ${parseFloat(condition.condition_value).toLocaleString('fr-FR')} €`;
    }

    if (condition.condition_field === 'bank_account_name') {
      return `${field} = "${condition.condition_value}"`;
    }
    
    return `${field} ${operator} "${condition.condition_value}"`;
  };

  const formatRuleConditions = (rule: AutomationRule) => {
    const conditions = rule.conditions || [];
    
    // If no conditions in new format, fallback to legacy format
    if (conditions.length === 0) {
      const field = fieldLabels[rule.condition_field] || rule.condition_field;
      const operator = operatorLabels[rule.condition_operator] || rule.condition_operator;
      return `${field} ${operator} "${rule.condition_value}"`;
    }
    
    return conditions.map(formatCondition);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
              {rules.filter(r => r.is_active).length} règles actives sur {rules.length}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une règle..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-56"
              />
            </div>
            <CreateRuleDialog categories={categories} onCreateRule={createRule} onCreateCategory={createCategory} />
          </div>
        </div>

        {rules.length === 0 ? (
          <div className="p-12 text-center">
            <Zap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h4 className="font-semibold text-foreground mb-2">Aucune règle d'automatisation</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Créez votre première règle pour automatiser la catégorisation de vos transactions.
            </p>
            <CreateRuleDialog 
              categories={categories} 
              onCreateRule={createRule}
              onCreateCategory={createCategory}
              trigger={
                <Button className="gradient-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer ma première règle
                </Button>
              }
            />
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h4 className="font-semibold text-foreground mb-2">Aucun résultat</h4>
            <p className="text-sm text-muted-foreground">
              Aucune règle ne correspond à "{search}"
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredRules.map((rule, index) => {
              const conditionTexts = formatRuleConditions(rule);
              const hasMultipleConditions = Array.isArray(conditionTexts) && conditionTexts.length > 1;
              
              return (
                <motion.div
                  key={rule.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.05 * index }}
                  className={cn(
                    "p-5 transition-colors",
                    rule.is_active ? "bg-card" : "bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                      rule.is_active 
                        ? "bg-success/10 text-success" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {rule.is_active ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                    </div>

                    {/* Rule Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={cn(
                          "font-semibold",
                          rule.is_active ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {rule.name}
                        </h4>
                        {rule.is_active && (
                          <Badge className="bg-success/10 text-success border-success/20">
                            Active
                          </Badge>
                        )}
                        {hasMultipleConditions && (
                          <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">
                            <Euro className="w-3 h-3 mr-1" />
                            Multi-critères
                          </Badge>
                        )}
                        {rule.match_count > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {rule.match_count} correspondances
                          </Badge>
                        )}
                      </div>
                      
                      {rule.created_at && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Créée le {new Date(rule.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      
                      {/* Rule Flow */}
                      <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
                        {Array.isArray(conditionTexts) ? (
                          conditionTexts.map((text, i) => (
                            <span key={i} className="flex items-center gap-2">
                              {i > 0 && <span className="text-accent font-medium">ET</span>}
                              <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                                {text}
                              </span>
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                            {conditionTexts}
                          </span>
                        )}
                        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span 
                          className="px-2 py-1 rounded-lg font-medium flex items-center gap-2"
                          style={{ 
                            backgroundColor: `${rule.category?.color}20`,
                            color: rule.category?.color 
                          }}
                        >
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: rule.category?.color }}
                          />
                          {rule.category?.name || 'Non assignée'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button 
                        onClick={() => setEditingRule(rule)}
                        className="p-2 rounded-lg hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary"
                        title="Modifier la règle"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRule(rule.id)}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer la règle ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. La règle "{rule.name}" sera définitivement supprimée.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="flex items-center gap-2 py-2">
                            <Checkbox
                              id={`decategorize-${rule.id}`}
                              checked={decategorizeOnDelete}
                              onCheckedChange={(v) => setDecategorizeOnDelete(!!v)}
                            />
                            <label htmlFor={`decategorize-${rule.id}`} className="text-sm cursor-pointer">
                              Décatégoriser les transactions associées
                            </label>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDecategorizeOnDelete(false)}>Annuler</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => {
                                deleteRule(rule.id, decategorizeOnDelete);
                                setDecategorizeOnDelete(false);
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Edit Rule Dialog */}
      <EditRuleDialog
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(null)}
        categories={categories}
        rule={editingRule}
        onUpdateRule={updateRule}
      />
    </div>
  );
}
