import { Edit3, Trash2, TrendingUp, TrendingDown, Folder, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsDownUp, CheckSquare, Ghost, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Category, CategoryGroup } from '@/hooks/useCategories';
import { useCategoryTransactionCounts } from '@/hooks/useCategoryTransactionCounts';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BulkAssignBar } from './BulkAssignDialog';
import { cn } from '@/lib/utils';

interface CategoryTableProps {
  groups: CategoryGroup[];
  type: 'income' | 'expense';
  onEdit: (category: Category) => void;
  onEditGroup: (group: Category) => void;
  onDelete: (id: string) => void;
  onDeleteGroup: (id: string, deleteChildren: boolean) => void;
  availableGroups: Category[];
  onBulkAssign: (categoryIds: string[], groupId: string) => void;
  onBulkUnassign: (categoryIds: string[]) => void;
}

const COLLAPSED_KEY = 'category-collapsed-groups';

export function CategoryTable({ 
  groups, 
  type, 
  onEdit, 
  onEditGroup, 
  onDelete, 
  onDeleteGroup,
  availableGroups,
  onBulkAssign,
  onBulkUnassign
}: CategoryTableProps) {
  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Orphan filter state
  const [showOrphansOnly, setShowOrphansOnly] = useState(false);
  const { counts, loading: countsLoading, loaded: countsLoaded, fetchCounts, isOrphan, getCount } = useCategoryTransactionCounts();

  // Get all group IDs for default collapsed state
  const allGroupIds = useMemo(() => 
    groups.filter(g => g.group).map(g => g.group!.id),
    [groups]
  );

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
      // Default: all groups collapsed
      return new Set(allGroupIds);
    } catch {
      return new Set(allGroupIds);
    }
  });

  // Update default collapsed when groups change
  useEffect(() => {
    if (allGroupIds.length > 0 && collapsedGroups.size === 0) {
      // If no saved state and groups exist, collapse all
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (!saved) {
        setCollapsedGroups(new Set(allGroupIds));
      }
    }
  }, [allGroupIds]);
  
  // Toggle orphan filter
  const toggleOrphanFilter = async () => {
    if (!countsLoaded && !showOrphansOnly) {
      // First time enabling: fetch counts
      await fetchCounts();
    }
    setShowOrphansOnly(!showOrphansOnly);
  };


  const toggleGroup = (groupId: string) => {
    const newSet = new Set(collapsedGroups);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);
    } else {
      newSet.add(groupId);
    }
    setCollapsedGroups(newSet);
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(Array.from(newSet)));
  };

  const expandAll = () => {
    setCollapsedGroups(new Set());
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([]));
  };

  const collapseAll = () => {
    setCollapsedGroups(new Set(allGroupIds));
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(allGroupIds));
  };

  const allCollapsed = allGroupIds.length > 0 && allGroupIds.every(id => collapsedGroups.has(id));
  const allExpanded = allGroupIds.length > 0 && !allGroupIds.some(id => collapsedGroups.has(id));

  // Get all selectable categories (not groups)
  const allCategories = useMemo(() => {
    return groups.flatMap(g => g.children);
  }, [groups]);

  // Count orphans for badge (must be after allCategories is defined)
  const orphanCount = useMemo(() => {
    if (!countsLoaded) return 0;
    return allCategories.filter(c => isOrphan(c.id)).length;
  }, [countsLoaded, allCategories, isOrphan]);

  // Filter categories based on orphan filter
  const filteredGroupedEntries = useMemo(() => {
    if (!showOrphansOnly || !countsLoaded) return groups.filter(g => g.group);
    return groups
      .filter(g => g.group)
      .map(g => ({
        ...g,
        children: g.children.filter(c => isOrphan(c.id))
      }))
      .filter(g => g.children.length > 0);
  }, [groups, showOrphansOnly, countsLoaded, isOrphan]);

  const filteredUngroupedCategories = useMemo(() => {
    const ungrouped = groups.filter(g => !g.group).flatMap(g => g.children);
    if (!showOrphansOnly || !countsLoaded) return ungrouped;
    return ungrouped.filter(c => isOrphan(c.id));
  }, [groups, showOrphansOnly, countsLoaded, isOrphan]);

  // Toggle selection for a category
  const toggleSelection = (categoryId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Select all / deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === allCategories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allCategories.map(c => c.id)));
    }
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  // Handle bulk assign
  const handleBulkAssign = (groupId: string) => {
    onBulkAssign(Array.from(selectedIds), groupId);
    exitSelectionMode();
  };

  // Handle bulk unassign
  const handleBulkUnassign = () => {
    onBulkUnassign(Array.from(selectedIds));
    exitSelectionMode();
  };

  // Count all categories (including in groups)
  const totalCount = groups.reduce((acc, g) => acc + g.children.length + (g.group ? 1 : 0), 0);
  if (totalCount === 0) return null;

  // Separate grouped and ungrouped
  const groupedEntries = groups.filter(g => g.group);
  const ungroupedCategories = groups.filter(g => !g.group).flatMap(g => g.children);

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
              type === 'income' ? 'bg-success/10' : 'bg-destructive/10'
            }`}>
              {type === 'income' ? (
                <TrendingUp className="w-3.5 h-3.5 text-success" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              )}
            </div>
            <h3 className="font-medium text-foreground">
              {type === 'income' ? 'Revenus' : 'Dépenses'}
            </h3>
            <span className="text-xs text-muted-foreground">({totalCount})</span>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Orphan filter toggle */}
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
                {showOrphansOnly ? 'Afficher toutes les catégories' : 'Afficher les catégories orphelines (0 transactions)'}
              </TooltipContent>
            </Tooltip>

            {/* Selection mode toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant={selectionMode ? "secondary" : "ghost"}
                  size="sm" 
                  className="h-7 px-2"
                  onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                >
                  <CheckSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{selectionMode ? 'Quitter le mode sélection' : 'Organiser les catégories'}</TooltipContent>
            </Tooltip>
            
            {/* Expand/Collapse All buttons */}
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
        
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectionMode && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedIds.size === allCategories.length && allCategories.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Nom</TableHead>
              <TableHead className="w-[100px] text-right">TVA</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Grouped categories */}
            {filteredGroupedEntries.map((group) => {
              const isCollapsed = collapsedGroups.has(group.group!.id);

              return (
                <GroupSection
                  key={group.group!.id}
                  group={group.group!}
                  children={group.children}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleGroup(group.group!.id)}
                  onEditGroup={onEditGroup}
                  onDeleteGroup={onDeleteGroup}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelection={toggleSelection}
                  showOrphanBadge={countsLoaded}
                  isOrphan={isOrphan}
                  getCount={getCount}
                />
              );
            })}
            
            {/* Ungrouped categories */}
            {filteredUngroupedCategories.length > 0 && (
              <>
                {filteredGroupedEntries.length > 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={selectionMode ? 5 : 4} className="py-1">
                      <div className="border-t border-border/50" />
                    </TableCell>
                  </TableRow>
                )}
                {filteredUngroupedCategories.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(category.id)}
                    onToggleSelection={toggleSelection}
                    showOrphanBadge={countsLoaded}
                    isOrphan={countsLoaded && isOrphan(category.id)}
                    transactionCount={getCount(category.id)}
                  />
                ))}
              </>
            )}

            {/* Empty state when filtering */}
            {showOrphansOnly && countsLoaded && filteredGroupedEntries.length === 0 && filteredUngroupedCategories.length === 0 && (
              <TableRow>
                <TableCell colSpan={selectionMode ? 5 : 4} className="py-8 text-center text-muted-foreground">
                  <Ghost className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Aucune catégorie orpheline</p>
                  <p className="text-xs">Toutes vos catégories ont au moins une transaction associée</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Action Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <BulkAssignBar
          selectedCount={selectedIds.size}
          type={type}
          groups={availableGroups}
          onAssign={handleBulkAssign}
          onUnassign={handleBulkUnassign}
          onCancel={exitSelectionMode}
        />
      )}
    </>
  );
}

interface CategoryRowProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  isChild?: boolean;
  isLast?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  showOrphanBadge?: boolean;
  isOrphan?: boolean;
  transactionCount?: number;
}

function CategoryRow({ 
  category, 
  onEdit, 
  onDelete, 
  isChild = false, 
  isLast = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelection,
  showOrphanBadge = false,
  isOrphan = false,
  transactionCount = 0
}: CategoryRowProps) {
  return (
    <TableRow className={cn(
      "group hover:bg-muted/30",
      isSelected && "bg-primary/5"
    )}>
      {selectionMode && (
        <TableCell className="py-2 w-[40px]">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelection?.(category.id)}
          />
        </TableCell>
      )}
      <TableCell className="py-2">
        <div className={cn("flex items-center", isChild && "pl-6")}>
          {isChild && (
            <div className="relative mr-2">
              <div className={cn(
                "absolute w-4 border-l-2 border-border",
                isLast ? "h-3 -top-1" : "h-full -top-4 bottom-0"
              )} />
              <div className="w-4 h-3 border-b-2 border-border rounded-bl-md" />
            </div>
          )}
          <div 
            className="w-6 h-6 rounded-md flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />
        </div>
      </TableCell>
      <TableCell className={cn("py-2 font-medium", isChild && "pl-4")}>
        <div className="flex items-center gap-2">
          <span>{category.name}</span>
          {showOrphanBadge && isOrphan && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-muted-foreground border-dashed">
              0 tx
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2 text-right text-muted-foreground">
        {(category.vat_rate * 100).toFixed(category.vat_rate * 100 % 1 === 0 ? 0 : 1)}%
      </TableCell>
      <TableCell className="py-2">
        {!selectionMode && (
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(category)}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. La catégorie "{category.name}" sera définitivement supprimée.
                    Les transactions associées ne seront pas supprimées mais n'auront plus de catégorie.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(category.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

interface GroupSectionProps {
  group: Category;
  children: Category[];
  isCollapsed: boolean;
  onToggle: () => void;
  onEditGroup: (group: Category) => void;
  onDeleteGroup: (id: string, deleteChildren: boolean) => void;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  showOrphanBadge?: boolean;
  isOrphan?: (categoryId: string) => boolean;
  getCount?: (categoryId: string) => number;
}

function GroupSection({ 
  group, 
  children, 
  isCollapsed, 
  onToggle, 
  onEditGroup, 
  onDeleteGroup,
  onEdit,
  onDelete,
  selectionMode,
  selectedIds,
  onToggleSelection,
  showOrphanBadge = false,
  isOrphan,
  getCount
}: GroupSectionProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Check if all children are selected
  const allChildrenSelected = children.length > 0 && children.every(c => selectedIds.has(c.id));
  const someChildrenSelected = children.some(c => selectedIds.has(c.id));
  
  // Toggle all children
  const toggleAllChildren = () => {
    if (allChildrenSelected) {
      children.forEach(c => {
        if (selectedIds.has(c.id)) {
          onToggleSelection(c.id);
        }
      });
    } else {
      children.forEach(c => {
        if (!selectedIds.has(c.id)) {
          onToggleSelection(c.id);
        }
      });
    }
  };

  return (
    <>
      {/* Group Header Row - Enhanced visual styling */}
      <TableRow 
        className="bg-muted/50 hover:bg-muted/70 cursor-pointer group border-t-2 border-border"
        onClick={selectionMode ? undefined : onToggle}
      >
        {selectionMode && (
          <TableCell className="py-3 w-[40px]">
            <Checkbox
              checked={allChildrenSelected}
              onCheckedChange={toggleAllChildren}
              className={cn(someChildrenSelected && !allChildrenSelected && "opacity-50")}
            />
          </TableCell>
        )}
        <TableCell className="py-3" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </Button>
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${group.color}25` }}
            >
              <Folder className="w-4 h-4" style={{ color: group.color }} />
            </div>
          </div>
        </TableCell>
        <TableCell className="py-3" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground uppercase tracking-wide">{group.name}</span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {children.length}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-3"></TableCell>
        <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
          {!selectionMode && (
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEditGroup(group)}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer le groupe "{group.name}" ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ce groupe contient {children.length} catégorie{children.length > 1 ? 's' : ''}.
                      Que souhaitez-vous faire ?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <Button
                      variant="outline"
                      onClick={() => {
                        onDeleteGroup(group.id, false);
                        setDeleteDialogOpen(false);
                      }}
                    >
                      Libérer les catégories
                    </Button>
                    <AlertDialogAction 
                      onClick={() => {
                        onDeleteGroup(group.id, true);
                        setDeleteDialogOpen(false);
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Tout supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </TableCell>
      </TableRow>

      {/* Children Rows with enhanced visual hierarchy - indented */}
      <AnimatePresence>
        {!isCollapsed && children.map((category, index) => (
          <motion.tr
            key={category.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, delay: index * 0.02 }}
            className={cn(
              "group border-b border-border/50 hover:bg-muted/20",
              selectedIds.has(category.id) && "bg-primary/5"
            )}
          >
            {selectionMode && (
              <TableCell className="py-2 w-[40px]">
                <Checkbox
                  checked={selectedIds.has(category.id)}
                  onCheckedChange={() => onToggleSelection(category.id)}
                />
              </TableCell>
            )}
            <TableCell className="py-2">
              <div className="flex items-center pl-8">
                <div 
                  className="w-5 h-5 rounded-md flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
              </div>
            </TableCell>
            <TableCell className="py-2 font-medium text-foreground pl-4">
              <div className="flex items-center gap-2">
                <span>{category.name}</span>
                {showOrphanBadge && isOrphan && isOrphan(category.id) && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 text-muted-foreground border-dashed">
                    0 tx
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="py-2 text-right text-muted-foreground">
              {(category.vat_rate * 100).toFixed(category.vat_rate * 100 % 1 === 0 ? 0 : 1)}%
            </TableCell>
            <TableCell className="py-2">
              {!selectionMode && (
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onEdit(category)}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. La catégorie "{category.name}" sera définitivement supprimée.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => onDelete(category.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </TableCell>
          </motion.tr>
        ))}
      </AnimatePresence>
    </>
  );
}
