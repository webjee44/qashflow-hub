import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronRight, 
  Edit3, 
  Trash2, 
  FolderPlus, 
  ChevronsUpDown, 
  ChevronsDownUp,
  Ghost,
  Loader2,
  GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { useCategoryTransactionCounts } from '@/hooks/useCategoryTransactionCounts';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';
import { cn } from '@/lib/utils';

const COLLAPSED_KEY = 'unified-category-collapsed';

interface UnifiedCategoryListProps {
  type: 'income' | 'expense';
  groups: CategoryGroup[];
  allCategories: Category[];
  onCreateGroup: (type: 'income' | 'expense') => void;
  onEditGroup: (group: Category) => void;
  onDeleteGroup: (groupId: string, deleteChildren: boolean) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (id: string, reassignToId: string | null) => void;
  onMoveToGroup: (categoryId: string, groupId: string | null) => void;
}

export function UnifiedCategoryList({
  type,
  groups,
  allCategories,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
  onEditCategory,
  onDeleteCategory,
  onMoveToGroup,
}: UnifiedCategoryListProps) {
  // Get all group IDs for this type
  const allGroupIds = useMemo(() => 
    groups.filter(g => g.group).map(g => g.group!.id),
    [groups]
  );

  // Collapsed state with localStorage persistence
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`${COLLAPSED_KEY}-${type}`);
      if (saved) return new Set(JSON.parse(saved));
      return new Set(allGroupIds); // Default: all collapsed
    } catch {
      return new Set(allGroupIds);
    }
  });

  // Drag state
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverUngrouped, setDragOverUngrouped] = useState(false);

  // Delete group dialog
  const [deleteGroupDialog, setDeleteGroupDialog] = useState<{
    open: boolean;
    group: Category | null;
    childrenCount: number;
  }>({ open: false, group: null, childrenCount: 0 });

  // Orphan filter
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const { loading: countsLoading, loaded: countsLoaded, fetchCounts, isOrphan, getCount } = useCategoryTransactionCounts();

  // Toggle group collapse
  const toggleGroup = (groupId: string) => {
    const newSet = new Set(collapsedGroups);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);
    } else {
      newSet.add(groupId);
    }
    setCollapsedGroups(newSet);
    localStorage.setItem(`${COLLAPSED_KEY}-${type}`, JSON.stringify(Array.from(newSet)));
  };

  const expandAll = () => {
    setCollapsedGroups(new Set());
    localStorage.setItem(`${COLLAPSED_KEY}-${type}`, JSON.stringify([]));
  };

  const collapseAll = () => {
    setCollapsedGroups(new Set(allGroupIds));
    localStorage.setItem(`${COLLAPSED_KEY}-${type}`, JSON.stringify(allGroupIds));
  };

  const allCollapsed = allGroupIds.length > 0 && allGroupIds.every(id => collapsedGroups.has(id));
  const allExpanded = allGroupIds.length > 0 && !allGroupIds.some(id => collapsedGroups.has(id));

  // Toggle orphan filter
  const toggleOrphanFilter = async () => {
    if (!countsLoaded && !showOrphansOnly) {
      await fetchCounts();
    }
    setShowOrphansOnly(!showOrphansOnly);
  };

  // Get all categories (for orphan count)
  const allCategoriesOfType = useMemo(() => 
    groups.flatMap(g => g.children),
    [groups]
  );

  const orphanCount = useMemo(() => {
    if (!countsLoaded) return 0;
    return allCategoriesOfType.filter(c => isOrphan(c.id)).length;
  }, [countsLoaded, allCategoriesOfType, isOrphan]);

  // Separate grouped and ungrouped
  const groupedEntries = useMemo(() => {
    const entries = groups.filter(g => g.group);
    if (!showOrphansOnly || !countsLoaded) return entries;
    return entries
      .map(g => ({
        ...g,
        children: g.children.filter(c => isOrphan(c.id))
      }))
      .filter(g => g.children.length > 0);
  }, [groups, showOrphansOnly, countsLoaded, isOrphan]);

  const ungroupedCategories = useMemo(() => {
    const ungrouped = groups.filter(g => !g.group).flatMap(g => g.children);
    if (!showOrphansOnly || !countsLoaded) return ungrouped;
    return ungrouped.filter(c => isOrphan(c.id));
  }, [groups, showOrphansOnly, countsLoaded, isOrphan]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, categoryId: string) => {
    setDraggedCategoryId(categoryId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', categoryId);
  };

  const handleDragEnd = () => {
    setDraggedCategoryId(null);
    setDragOverGroupId(null);
    setDragOverUngrouped(false);
  };

  const handleDragOverGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
    setDragOverUngrouped(false);
  };

  const handleDragOverUngrouped = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(null);
    setDragOverUngrouped(true);
  };

  const handleDragLeave = () => {
    setDragOverGroupId(null);
    setDragOverUngrouped(false);
  };

  const handleDropOnGroup = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    const categoryId = e.dataTransfer.getData('text/plain');
    if (categoryId && categoryId !== groupId) {
      onMoveToGroup(categoryId, groupId);
    }
    handleDragEnd();
  };

  const handleDropOnUngrouped = (e: React.DragEvent) => {
    e.preventDefault();
    const categoryId = e.dataTransfer.getData('text/plain');
    if (categoryId) {
      onMoveToGroup(categoryId, null);
    }
    handleDragEnd();
  };

  const handleDeleteGroupClick = (group: Category, childrenCount: number) => {
    setDeleteGroupDialog({ open: true, group, childrenCount });
  };

  const totalCount = groups.reduce((acc, g) => acc + g.children.length, 0);

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header with CTA */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onCreateGroup(type)}
            >
              <FolderPlus className="w-4 h-4" />
              Ajouter un groupe
            </Button>
            <span className="text-xs text-muted-foreground">
              {totalCount} catégorie{totalCount > 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Orphan filter */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={showOrphansOnly ? "secondary" : "ghost"}
                  size="sm" 
                  className="h-7 px-2 gap-1"
                  onClick={toggleOrphanFilter}
                  disabled={countsLoading}
                >
                  {countsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ghost className="w-4 h-4" />
                  )}
                  {countsLoaded && orphanCount > 0 && (
                    <span className="text-xs">{orphanCount}</span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showOrphansOnly ? 'Afficher toutes' : 'Catégories orphelines (0 tx)'}
              </TooltipContent>
            </Tooltip>

            {/* Expand/Collapse */}
            {allGroupIds.length > 0 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2"
                      onClick={expandAll}
                      disabled={allExpanded}
                    >
                      <ChevronsDownUp className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tout déplier</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2"
                      onClick={collapseAll}
                      disabled={allCollapsed}
                    >
                      <ChevronsUpDown className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tout replier</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {/* List content */}
        <div className="divide-y divide-border">
          {/* Grouped entries */}
          {groupedEntries.map(({ group, children }) => {
            if (!group) return null;
            const isCollapsed = collapsedGroups.has(group.id);
            const isDropTarget = dragOverGroupId === group.id;

            return (
              <div key={group.id}>
                {/* Group header */}
                <div
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5 bg-muted/50 cursor-pointer transition-all",
                    isDropTarget && "ring-2 ring-inset ring-primary bg-primary/5"
                  )}
                  onClick={() => toggleGroup(group.id)}
                  onDragOver={(e) => handleDragOverGroup(e, group.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnGroup(e, group.id)}
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <span className="font-semibold text-sm uppercase tracking-wide text-foreground">
                      {group.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({children.length})
                    </span>
                  </div>
                  
                  <div 
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEditGroup(group)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeleteGroupClick(group, children.length)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Group children */}
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      {children.map((category) => (
                        <CategoryRow
                          key={category.id}
                          category={category}
                          allCategories={allCategories}
                          onEdit={onEditCategory}
                          onDelete={onDeleteCategory}
                          isDragging={draggedCategoryId === category.id}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          showOrphanBadge={countsLoaded}
                          isOrphan={countsLoaded && isOrphan(category.id)}
                          transactionCount={getCount(category.id)}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* Ungrouped section */}
          {ungroupedCategories.length > 0 && (
            <div
              className={cn(
                "transition-all",
                dragOverUngrouped && "ring-2 ring-inset ring-primary bg-primary/5"
              )}
              onDragOver={handleDragOverUngrouped}
              onDragLeave={handleDragLeave}
              onDrop={handleDropOnUngrouped}
            >
              {groupedEntries.length > 0 && (
                <div className="px-4 py-2 bg-muted/30">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    Non groupées ({ungroupedCategories.length})
                  </span>
                </div>
              )}
              {ungroupedCategories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  allCategories={allCategories}
                  onEdit={onEditCategory}
                  onDelete={onDeleteCategory}
                  isDragging={draggedCategoryId === category.id}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  showOrphanBadge={countsLoaded}
                  isOrphan={countsLoaded && isOrphan(category.id)}
                  transactionCount={getCount(category.id)}
                />
              ))}
            </div>
          )}

          {/* Empty state when filtering */}
          {showOrphansOnly && countsLoaded && groupedEntries.length === 0 && ungroupedCategories.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <Ghost className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Aucune catégorie orpheline</p>
              <p className="text-xs">Toutes vos catégories ont au moins une transaction</p>
            </div>
          )}

          {/* Empty state (no categories at all) */}
          {!showOrphansOnly && totalCount === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">Aucune catégorie {type === 'income' ? 'de revenu' : 'de dépense'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Group Dialog */}
      <AlertDialog 
        open={deleteGroupDialog.open} 
        onOpenChange={(open) => setDeleteGroupDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer le groupe "{deleteGroupDialog.group?.name}" ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ce groupe contient {deleteGroupDialog.childrenCount} catégorie{deleteGroupDialog.childrenCount > 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (deleteGroupDialog.group) {
                  onDeleteGroup(deleteGroupDialog.group.id, false);
                  setDeleteGroupDialog({ open: false, group: null, childrenCount: 0 });
                }
              }}
            >
              Libérer les catégories
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (deleteGroupDialog.group) {
                  onDeleteGroup(deleteGroupDialog.group.id, true);
                  setDeleteGroupDialog({ open: false, group: null, childrenCount: 0 });
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

// Category row component
interface CategoryRowProps {
  category: Category;
  allCategories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (id: string, reassignToId: string | null) => void;
  isDragging?: boolean;
  onDragStart: (e: React.DragEvent, categoryId: string) => void;
  onDragEnd: () => void;
  showOrphanBadge?: boolean;
  isOrphan?: boolean;
  transactionCount?: number;
}

function CategoryRow({
  category,
  allCategories,
  onEdit,
  onDelete,
  isDragging,
  onDragStart,
  onDragEnd,
  showOrphanBadge,
  isOrphan,
}: CategoryRowProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeleteConfirm = (reassignToId: string | null) => {
    onDelete(category.id, reassignToId);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, category.id)}
        onDragEnd={onDragEnd}
        className={cn(
          "group flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing",
          isDragging && "opacity-50 bg-muted/50"
        )}
      >
        <div className="flex items-center gap-3 pl-8">
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div
            className="w-4 h-4 rounded-md flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <span className="text-sm text-foreground">{category.name}</span>
          {showOrphanBadge && isOrphan && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-muted-foreground border-dashed">
              0 tx
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-muted-foreground">
            TVA {(category.vat_rate * 100).toFixed(0)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(category)}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <DeleteCategoryDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        category={category}
        allCategories={allCategories}
        transactionCount={0}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
