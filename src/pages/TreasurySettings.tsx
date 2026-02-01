import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tags, Zap, Folder } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCategories, Category } from '@/hooks/useCategories';
import { CategoryTable } from '@/components/categories/CategoryTable';
import { CategoryDialog } from '@/components/categories/CategoryDialog';
import { GroupDialog } from '@/components/categories/GroupDialog';
import { GroupsManager } from '@/components/categories/GroupsManager';
import { AutomationRules } from '@/components/automations/AutomationRules';
import { ZenfirstImportDialog } from '@/components/settings/ZenfirstImportDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Wand2,
  Upload
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
    bulkAssignToGroup,
    bulkRemoveFromGroup
  } = useCategories();
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [groupDialog, setGroupDialog] = useState<GroupDialogState>({
    open: false,
    mode: 'create',
    editGroup: null,
  });
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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
  const totalGroups = [...incomeGroups, ...expenseGroups].filter(g => g.group).length;

  return (
    <div className="space-y-6">
      {/* Header with stats inline */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader 
          title="Réglages Trésorerie" 
          subtitle="Configurez vos catégories et règles d'automatisation" 
        />
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge variant="secondary" className="h-8 px-3 gap-2">
            <Tags className="w-3.5 h-3.5" />
            {totalCategories} catégories
          </Badge>
          <Badge variant="secondary" className="h-8 px-3 gap-2">
            <Folder className="w-3.5 h-3.5" />
            {totalGroups} groupes
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        {/* Onglets bien visibles */}
        <TabsList className="bg-card border border-border shadow-sm h-12 p-1.5 w-full max-w-md">
          <TabsTrigger 
            value="categories" 
            className="flex-1 h-9 px-4 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            <Tags className="h-4 w-4" />
            Catégories
          </TabsTrigger>
          <TabsTrigger 
            value="automations" 
            className="flex-1 h-9 px-4 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
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
              {/* Empty State */}
              {totalCategories === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card rounded-2xl border border-border p-12 text-center"
                >
                  <Wand2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h4 className="font-semibold text-foreground mb-2">Aucune catégorie</h4>
                  <p className="text-sm text-muted-foreground mb-6">
                    Créez vos premières catégories, importez depuis Zenfirst ou utilisez les catégories par défaut.
                  </p>
                  <div className="flex justify-center gap-3 flex-wrap">
                    <Button onClick={() => setImportDialogOpen(true)} variant="outline">
                      <Upload className="w-4 h-4 mr-2" />
                      Importer depuis Zenfirst
                    </Button>
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
              ) : (
                <>
                  {/* Groups Manager Section */}
                  <GroupsManager
                    incomeGroups={incomeGroups}
                    expenseGroups={expenseGroups}
                    onCreateGroup={openCreateGroupDialog}
                    onEditGroup={handleEditGroup}
                    onDeleteGroup={handleDeleteGroup}
                  />

                  {/* Categories Tables with actions */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-success" />
                        <h3 className="font-semibold text-foreground">Revenus ({incomeCategories.length})</h3>
                      </div>
                      <CategoryDialog
                        onSave={createCategory}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Ajouter
                          </Button>
                        }
                      />
                    </div>
                    <CategoryTable 
                      groups={incomeGroups}
                      type="income"
                      onEdit={handleEdit}
                      onEditGroup={handleEditGroup}
                      onDelete={deleteCategory}
                      onDeleteGroup={handleDeleteGroup}
                      availableGroups={incomeGroups.filter(g => g.group).map(g => g.group!)}
                      onBulkAssign={bulkAssignToGroup}
                      onBulkUnassign={bulkRemoveFromGroup}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <TrendingDown className="w-5 h-5 text-destructive" />
                        <h3 className="font-semibold text-foreground">Dépenses ({expenseCategories.length})</h3>
                      </div>
                      <CategoryDialog
                        onSave={createCategory}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Ajouter
                          </Button>
                        }
                      />
                    </div>
                    <CategoryTable 
                      groups={expenseGroups}
                      type="expense"
                      onEdit={handleEdit}
                      onEditGroup={handleEditGroup}
                      onDelete={deleteCategory}
                      onDeleteGroup={handleDeleteGroup}
                      availableGroups={expenseGroups.filter(g => g.group).map(g => g.group!)}
                      onBulkAssign={bulkAssignToGroup}
                      onBulkUnassign={bulkRemoveFromGroup}
                    />
                  </div>

                  {/* Section Import en bas - discrète */}
                  <Card className="border-dashed mt-8">
                    <CardContent className="flex items-center justify-center gap-4 py-4">
                      <Button variant="ghost" size="sm" onClick={() => setImportDialogOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Importer depuis Zenfirst
                      </Button>
                      <div className="h-4 w-px bg-border" />
                      <Button variant="ghost" size="sm" onClick={initializeDefaultCategories}>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Réinitialiser par défaut
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Edit Category Dialog */}
              <CategoryDialog
                category={editingCategory}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={handleSaveEdit}
                onClose={() => setEditingCategory(null)}
              />

              {/* Import Dialog */}
              <ZenfirstImportDialog 
                open={importDialogOpen} 
                onOpenChange={setImportDialogOpen} 
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
