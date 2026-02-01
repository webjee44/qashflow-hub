import { useState } from 'react';
import { Folder, Edit3, Trash2, FolderPlus, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Category, CategoryGroup } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

interface GroupsManagerProps {
  incomeGroups: CategoryGroup[];
  expenseGroups: CategoryGroup[];
  onCreateGroup: () => void;
  onEditGroup: (group: Category) => void;
  onDeleteGroup: (groupId: string, deleteChildren: boolean) => void;
}

export function GroupsManager({
  incomeGroups,
  expenseGroups,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: GroupsManagerProps) {
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    group: Category | null;
    childrenCount: number;
  }>({ open: false, group: null, childrenCount: 0 });

  // Get only actual groups (entries with a group property)
  const incomeGroupItems = incomeGroups.filter(g => g.group);
  const expenseGroupItems = expenseGroups.filter(g => g.group);
  const allGroups = [...incomeGroupItems, ...expenseGroupItems];

  if (allGroups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Folder className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Aucun groupe</p>
                <p className="text-sm text-muted-foreground">
                  Créez des groupes pour organiser vos catégories
                </p>
              </div>
            </div>
            <Button onClick={onCreateGroup} variant="outline" size="sm">
              <FolderPlus className="w-4 h-4 mr-2" />
              Créer un groupe
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleDeleteClick = (group: Category, childrenCount: number) => {
    setDeleteDialog({ open: true, group, childrenCount });
  };

  return (
    <>
      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Groupes ({allGroups.length})
            </CardTitle>
            <Button onClick={onCreateGroup} variant="outline" size="sm">
              <FolderPlus className="w-4 h-4 mr-2" />
              Créer un groupe
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allGroups.map(({ group, children }) => {
              if (!group) return null;
              const isIncome = group.type === 'income';
              
              return (
                <div
                  key={group.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border bg-card transition-colors hover:bg-muted/50 cursor-pointer group",
                    isIncome ? "border-success/30" : "border-destructive/30"
                  )}
                  onClick={() => onEditGroup(group)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${group.color}20` }}
                    >
                      <Folder className="w-4 h-4" style={{ color: group.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">
                        {group.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-xs px-1.5 py-0",
                            isIncome 
                              ? "bg-success/10 text-success hover:bg-success/20" 
                              : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                          )}
                        >
                          {isIncome ? 'Revenu' : 'Dépense'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {children.length} catégorie{children.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  
                  <div 
                    className="flex items-center gap-1 ml-2 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditGroup(group);
                      }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(group, children.length);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delete Group Dialog */}
      <AlertDialog 
        open={deleteDialog.open} 
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer le groupe "{deleteDialog.group?.name}" ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ce groupe contient {deleteDialog.childrenCount} catégorie{deleteDialog.childrenCount > 1 ? 's' : ''}.
              Que souhaitez-vous faire ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (deleteDialog.group) {
                  onDeleteGroup(deleteDialog.group.id, false);
                  setDeleteDialog({ open: false, group: null, childrenCount: 0 });
                }
              }}
            >
              Libérer les catégories
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog.group) {
                  onDeleteGroup(deleteDialog.group.id, true);
                  setDeleteDialog({ open: false, group: null, childrenCount: 0 });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Tout supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
