import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tags, Zap } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCategories, Category } from '@/hooks/useCategories';
import { CategoryTable } from '@/components/categories/CategoryTable';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { GroupDialog } from '@/components/categories/GroupDialog';
import { AutomationRules } from '@/components/automations/AutomationRules';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Sparkles,
  Wand2,
  FolderPlus
} from 'lucide-react';

interface GroupDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  editGroup: Category | null;
}

export default function TreasurySettings() {
  const { 
    categories,
    incomeCategories, 
    expenseCategories, 
    loading, 
    createCategory, 
    updateCategory, 
    deleteCategory,
    initializeDefaultCategories,
    getGroupedCategories,
    createGroup,
    updateGroup,
    deleteGroup,
    isGroup
  } = useCategories();
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState>({
    open: false,
    mode: 'create',
    editGroup: null,
  });

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setEditDialogOpen(true);
  };

  const handleEditGroup = (group: Category) => {
    setGroupDialog({
      open: true,
      mode: 'edit',
      editGroup: group,
    });
  };

  const openCreateGroupDialog = () => {
    setGroupDialog({
      open: true,
      mode: 'create',
      editGroup: null,
    });
  };

  const closeGroupDialog = () => {
    setGroupDialog({
      open: false,
      mode: 'create',
      editGroup: null,
    });
  };

  const handleSaveEdit = async (data: {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
    vat_rate: number;
    parent_id?: string | null;
  }) => {
    if (editingCategory) {
      return await updateCategory(editingCategory.id, data);
    }
    return null;
  };

  const handleSaveGroup = async (data: {
    name: string;
    color: string;
    type: 'income' | 'expense';
    categoryIds: string[];
  }) => {
    let result;
    if (groupDialog.editGroup) {
      result = await updateGroup(groupDialog.editGroup.id, data);
    } else {
      result = await createGroup(data);
    }
    closeGroupDialog();
    return result;
  };

  const handleDeleteGroup = async (groupId: string, deleteChildren: boolean) => {
    await deleteGroup(groupId, deleteChildren);
  };

  const incomeGroups = getGroupedCategories('income');
  const expenseGroups = getGroupedCategories('expense');
  const totalCategories = incomeCategories.length + expenseCategories.length;

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Réglages Trésorerie" 
        subtitle="Configurez vos catégories et règles d'automatisation" 
      />

      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            Catégories
          </TabsTrigger>
          <TabsTrigger value="automations" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automatisations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Actions */}
              {totalCategories > 0 && (
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={openCreateGroupDialog}>
                    <FolderPlus className="w-4 h-4 mr-2" />
                    Ajouter un groupe
                  </Button>
                  <CategoryDialog
                    onSave={createCategory}
                    trigger={
                      <Button className="gradient-primary">
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter une catégorie
                      </Button>
                    }
                  />
                </div>
              )}

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
                  groups={incomeGroups}
                  type="income"
                  onEdit={handleEdit}
                  onEditGroup={handleEditGroup}
                  onDelete={deleteCategory}
                  onDeleteGroup={handleDeleteGroup}
                />
                <CategoryTable 
                  groups={expenseGroups}
                  type="expense"
                  onEdit={handleEdit}
                  onEditGroup={handleEditGroup}
                  onDelete={deleteCategory}
                  onDeleteGroup={handleDeleteGroup}
                />
              </div>

              {/* Edit Category Dialog */}
              <CategoryDialog
                category={editingCategory}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={handleSaveEdit}
                onClose={() => setEditingCategory(null)}
              />

              {/* Group Dialog */}
              {groupDialog.open && (
                <GroupDialog
                  key={groupDialog.mode === 'edit' ? groupDialog.editGroup?.id : 'create'}
                  categories={categories}
                  editGroup={groupDialog.editGroup}
                  mode={groupDialog.mode}
                  open={groupDialog.open}
                  onOpenChange={(open) => {
                    if (!open) closeGroupDialog();
                  }}
                  onSave={handleSaveGroup}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="automations" className="mt-6">
          <AutomationRules />
        </TabsContent>
      </Tabs>
    </div>
  );
}
