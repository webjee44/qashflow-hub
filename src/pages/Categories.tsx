import { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { useCategories, Category } from '@/hooks/useCategories';
import { CategoryTable } from '@/components/categories/CategoryTable';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Sparkles,
  Wand2
} from 'lucide-react';

export default function Categories() {
  const { 
    categories,
    incomeCategories, 
    expenseCategories, 
    loading, 
    createCategory, 
    updateCategory, 
    deleteCategory,
    initializeDefaultCategories
  } = useCategories();
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
    parent_id?: string | null;
  }) => {
    if (editingCategory) {
      return await updateCategory(editingCategory.id, data);
    }
    return null;
  };

  // Get potential parent categories (categories that could be groups)
  const availableParents = categories.filter(c => !c.parent_id);

  const totalCategories = incomeCategories.length + expenseCategories.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Header 
        title="Catégories" 
        subtitle="Gérez vos catégories pour la classification automatique par IA" 
      />

      {/* AI Info Banner */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/20 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Classification intelligente</h3>
            <p className="text-sm text-muted-foreground mt-1">
              L'IA utilise ces catégories pour classifier automatiquement vos transactions. 
              Plus vos catégories sont précises, plus la classification sera pertinente.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-5 shadow-card"
        >
          <p className="text-2xl font-bold text-foreground">{totalCategories}</p>
          <p className="text-sm text-muted-foreground">Catégories totales</p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-5 shadow-card"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <p className="text-2xl font-bold text-foreground">{incomeCategories.length}</p>
          </div>
          <p className="text-sm text-muted-foreground">Catégories revenus</p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border p-5 shadow-card"
        >
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-destructive" />
            <p className="text-2xl font-bold text-foreground">{expenseCategories.length}</p>
          </div>
          <p className="text-sm text-muted-foreground">Catégories dépenses</p>
        </motion.div>
      </div>

      {/* Empty State */}
      {totalCategories === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card rounded-2xl border border-border p-12 text-center"
        >
          <Wand2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h4 className="font-semibold text-foreground mb-2">Aucune catégorie</h4>
          <p className="text-sm text-muted-foreground mb-6">
            Créez vos premières catégories ou utilisez les catégories par défaut.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={initializeDefaultCategories} variant="outline">
              <Wand2 className="w-4 h-4 mr-2" />
              Catégories par défaut
            </Button>
            <CategoryDialog
              onSave={createCategory}
              availableParents={availableParents}
              trigger={
                <Button className="gradient-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une catégorie
                </Button>
              }
            />
          </div>
        </motion.div>
      )}

      {/* Categories Tables */}
      <div className="space-y-4">
        <CategoryTable 
          categories={incomeCategories}
          type="income"
          onEdit={handleEdit}
          onDelete={deleteCategory}
        />
        <CategoryTable 
          categories={expenseCategories}
          type="expense"
          onEdit={handleEdit}
          onDelete={deleteCategory}
        />
      </div>

      {/* Add Button (when categories exist) */}
      {totalCategories > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center"
        >
          <CategoryDialog
            onSave={createCategory}
            availableParents={availableParents}
            trigger={
              <Button className="gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une catégorie
              </Button>
            }
          />
        </motion.div>
      )}

      {/* Edit Dialog */}
      <CategoryDialog
        category={editingCategory}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleSaveEdit}
        onClose={() => setEditingCategory(null)}
        availableParents={availableParents.filter(p => p.id !== editingCategory?.id)}
      />
    </div>
  );
}
