import { Edit3, Trash2, TrendingUp, TrendingDown, Folder, ChevronDown, ChevronRight, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Category, CategoryGroup } from '@/hooks/useCategories';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CategoryTableProps {
  groups: CategoryGroup[];
  type: 'income' | 'expense';
  onEdit: (category: Category) => void;
  onEditGroup: (group: Category) => void;
  onDelete: (id: string) => void;
  onDeleteGroup: (id: string, deleteChildren: boolean) => void;
}

const COLLAPSED_KEY = 'category-collapsed-groups';

export function CategoryTable({ groups, type, onEdit, onEditGroup, onDelete, onDeleteGroup }: CategoryTableProps) {
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

  // Count all categories (including in groups)
  const totalCount = groups.reduce((acc, g) => acc + g.children.length + (g.group ? 1 : 0), 0);
  if (totalCount === 0) return null;

  // Separate grouped and ungrouped
  const groupedEntries = groups.filter(g => g.group);
  const ungroupedCategories = groups.filter(g => !g.group).flatMap(g => g.children);

  return (
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
        
        {/* Expand/Collapse All buttons */}
        {allGroupIds.length > 0 && (
          <div className="flex items-center gap-1">
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
          </div>
        )}
      </div>
      
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Nom</TableHead>
            <TableHead className="w-[100px] text-right">TVA</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Grouped categories */}
          {groupedEntries.map((group) => {
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
              />
            );
          })}
          
          {/* Ungrouped categories */}
          {ungroupedCategories.length > 0 && (
            <>
              {groupedEntries.length > 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-1">
                    <div className="border-t border-border/50" />
                  </TableCell>
                </TableRow>
              )}
              {ungroupedCategories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface CategoryRowProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  isChild?: boolean;
  isLast?: boolean;
}

function CategoryRow({ category, onEdit, onDelete, isChild = false, isLast = false }: CategoryRowProps) {
  return (
    <TableRow className="group hover:bg-muted/30">
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
        {category.name}
      </TableCell>
      <TableCell className="py-2 text-right text-muted-foreground">
        {(category.vat_rate * 100).toFixed(category.vat_rate * 100 % 1 === 0 ? 0 : 1)}%
      </TableCell>
      <TableCell className="py-2">
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
}

function GroupSection({ 
  group, 
  children, 
  isCollapsed, 
  onToggle, 
  onEditGroup, 
  onDeleteGroup,
  onEdit,
  onDelete
}: GroupSectionProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      {/* Group Header Row - More prominent styling */}
      <TableRow 
        className="bg-muted/50 hover:bg-muted/70 cursor-pointer group border-t border-border"
        onClick={onToggle}
      >
        <TableCell className="py-3">
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
        <TableCell className="py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground text-base">{group.name}</span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {children.length}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-3"></TableCell>
        <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
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
        </TableCell>
      </TableRow>

      {/* Children Rows with enhanced visual hierarchy */}
      <AnimatePresence>
        {!isCollapsed && children.map((category, index) => (
          <motion.tr
            key={category.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, delay: index * 0.02 }}
            className="group border-b border-border/50 hover:bg-muted/20"
          >
            <TableCell className="py-2">
              <div className="flex items-center pl-6">
                <div className="relative mr-2 h-5">
                  {/* Vertical line connecting to parent */}
                  <div className={cn(
                    "absolute left-0 w-px bg-border",
                    index === children.length - 1 ? "h-2 top-0" : "h-full -top-2"
                  )} style={{ width: '2px' }} />
                  {/* Horizontal connector */}
                  <div className="absolute left-0 top-2 w-3 border-b-2 border-border rounded-bl-md" />
                </div>
                <div 
                  className="w-6 h-6 rounded-md flex-shrink-0 ml-2"
                  style={{ backgroundColor: category.color }}
                />
              </div>
            </TableCell>
            <TableCell className="py-2 font-medium text-foreground pl-4">
              {category.name}
            </TableCell>
            <TableCell className="py-2 text-right text-muted-foreground">
              {(category.vat_rate * 100).toFixed(category.vat_rate * 100 % 1 === 0 ? 0 : 1)}%
            </TableCell>
            <TableCell className="py-2">
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
            </TableCell>
          </motion.tr>
        ))}
      </AnimatePresence>
    </>
  );
}
