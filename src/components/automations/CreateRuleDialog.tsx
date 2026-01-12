import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Zap, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Category } from '@/hooks/useAutomationRules';
import { CategoryDialog } from '@/components/categories/CategoryDialog';

interface CreateRuleDialogProps {
  categories: Category[];
  onCreateRule: (rule: {
    name: string;
    condition_field: string;
    condition_operator: string;
    condition_value: string;
    action_type: string;
    target_category_id: string | null;
  }) => Promise<any>;
  onCreateCategory?: (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
  }) => Promise<any>;
  trigger?: React.ReactNode;
}

const conditionFields = [
  { value: 'description', label: 'Description' },
  { value: 'amount', label: 'Montant' },
  { value: 'source', label: 'Source' },
];

const conditionOperators: Record<string, { value: string; label: string }[]> = {
  description: [
    { value: 'contains', label: 'Contient' },
    { value: 'starts_with', label: 'Commence par' },
    { value: 'ends_with', label: 'Se termine par' },
    { value: 'equals', label: 'Est égal à' },
  ],
  amount: [
    { value: 'greater_than', label: 'Supérieur à' },
    { value: 'less_than', label: 'Inférieur à' },
    { value: 'equals', label: 'Égal à' },
    { value: 'between', label: 'Entre' },
  ],
  source: [
    { value: 'equals', label: 'Est égal à' },
    { value: 'contains', label: 'Contient' },
  ],
};

export function CreateRuleDialog({ categories, onCreateRule, onCreateCategory, trigger }: CreateRuleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [form, setForm] = useState({
    name: '',
    condition_field: 'description',
    condition_operator: 'contains',
    condition_value: '',
    action_type: 'categorize',
    target_category_id: '',
  });

  const handleCreateCategory = async (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
  }) => {
    if (onCreateCategory) {
      const result = await onCreateCategory(data);
      if (result?.id) {
        // Sélectionner automatiquement la nouvelle catégorie
        setForm({ ...form, target_category_id: result.id });
      }
      return result;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.condition_value || !form.target_category_id) return;

    setLoading(true);
    const result = await onCreateRule({
      ...form,
      target_category_id: form.target_category_id || null,
    });
    setLoading(false);

    if (result) {
      setOpen(false);
      setForm({
        name: '',
        condition_field: 'description',
        condition_operator: 'contains',
        condition_value: '',
        action_type: 'categorize',
        target_category_id: '',
      });
    }
  };

  const availableOperators = conditionOperators[form.condition_field] || conditionOperators.description;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle règle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Créer une règle d'automatisation
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de la règle</Label>
            <Input
              id="name"
              placeholder="Ex: Salaires mensuels"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-4 p-4 bg-muted/50 rounded-xl">
            <p className="text-sm font-medium text-foreground">Condition</p>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Champ</Label>
                <Select
                  value={form.condition_field}
                  onValueChange={(value) => setForm({ 
                    ...form, 
                    condition_field: value,
                    condition_operator: conditionOperators[value]?.[0]?.value || 'contains'
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[200] bg-popover">
                    {conditionFields.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Opérateur</Label>
                <Select
                  value={form.condition_operator}
                  onValueChange={(value) => setForm({ ...form, condition_operator: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[200] bg-popover">
                    {availableOperators.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valeur</Label>
              <Input
                placeholder={form.condition_field === 'amount' ? 'Ex: 1000' : 'Ex: salaire'}
                value={form.condition_value}
                onChange={(e) => setForm({ ...form, condition_value: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4 p-4 bg-primary/5 rounded-xl">
            <p className="text-sm font-medium text-foreground">Action</p>
            
            <div className="space-y-2">
              <Label>Catégoriser dans</Label>
              <Select
                value={form.target_category_id}
                onValueChange={(value) => {
                  if (value === '__new__') {
                    setShowCategoryDialog(true);
                  } else {
                    setForm({ ...form, target_category_id: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200] bg-popover">
                  {onCreateCategory && (
                    <>
                      <SelectItem value="__new__">
                        <div className="flex items-center gap-2 text-primary">
                          <PlusCircle className="w-4 h-4" />
                          Créer une nouvelle catégorie
                        </div>
                      </SelectItem>
                      <SelectSeparator />
                    </>
                  )}
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dialog pour créer une nouvelle catégorie */}
          <CategoryDialog
            open={showCategoryDialog}
            onOpenChange={setShowCategoryDialog}
            onSave={handleCreateCategory}
          />

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              className="gradient-primary"
              disabled={loading || !form.name || !form.condition_value || !form.target_category_id}
            >
              {loading ? 'Création...' : 'Créer la règle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
