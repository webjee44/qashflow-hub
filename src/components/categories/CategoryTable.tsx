import { Edit3, Trash2, TrendingUp, TrendingDown, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

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

  // Count all categories (including in groups)
  const totalCount = groups.reduce((acc, g) => acc + g.children.length + (g.group ? 1 : 0), 0);
  if (totalCount === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
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
          {groups.map((group) => {
            // Ungrouped categories
            if (!group.group) {
              return group.children.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ));
            }

            // Group with children
            const isCollapsed = collapsedGroups.has(group.group.id);

            return (
              <GroupSection
                key={group.group.id}
                group={group.group}
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
}

function CategoryRow({ category, onEdit, onDelete, isChild = false }: CategoryRowProps) {
  return (
    <TableRow className="group">
      <TableCell className="py-2">
        <div className={cn("flex items-center", isChild && "pl-4")}>
          {isChild && (
            <div className="w-4 h-full border-l-2 border-b-2 border-border rounded-bl-md mr-2 -mt-3 h-5" />
          )}
          <div 
            className="w-6 h-6 rounded-md flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />
        </div>
      </TableCell>
      <TableCell className={cn("py-2 font-medium", isChild && "pl-6")}>
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
      {/* Group Header Row */}
      <TableRow 
        className="bg-muted/40 hover:bg-muted/60 cursor-pointer group"
        onClick={onToggle}
      >
        <TableCell className="py-2">
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
            <div 
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ backgroundColor: `${group.color}30` }}
            >
              <Folder className="w-3.5 h-3.5" style={{ color: group.color }} />
            </div>
          </div>
        </TableCell>
        <TableCell className="py-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{group.name}</span>
            <span className="text-xs text-muted-foreground">({children.length})</span>
          </div>
        </TableCell>
        <TableCell className="py-2"></TableCell>
        <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
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

      {/* Children Rows */}
      <AnimatePresence>
        {!isCollapsed && children.map((category) => (
          <motion.tr
            key={category.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="group border-b"
          >
            <TableCell className="py-2">
              <div className="flex items-center pl-4">
                <div className="w-4 border-l-2 border-b-2 border-border rounded-bl-md mr-2 h-4 -mt-2" />
                <div 
                  className="w-6 h-6 rounded-md flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
              </div>
            </TableCell>
            <TableCell className="py-2 font-medium pl-6">
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
