import { useState, useMemo } from 'react';
import { Check, PlusCircle, Search, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Category, CategoryGroup } from '@/hooks/useCategories';

interface CategorySearchSelectProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  onCreateCategory?: () => void;
  incomeCategories: Category[];
  expenseCategories: Category[];
  getCategoryName: (categoryId: string | null) => string;
  getCategoryColor: (categoryId: string | null) => string | undefined;
  isUncategorized?: boolean;
  className?: string;
  triggerClassName?: string;
}

// Group categories by parent for hierarchical display
function getGroupedCategories(categories: Category[]): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  const childrenByParent = new Map<string, Category[]>();
  const topLevelCats: Category[] = [];

  // First pass: identify children
  categories.forEach(cat => {
    if (cat.parent_id) {
      const existing = childrenByParent.get(cat.parent_id) || [];
      existing.push(cat);
      childrenByParent.set(cat.parent_id, existing);
    }
  });

  // Second pass: separate groups from regular categories
  categories.forEach(cat => {
    if (!cat.parent_id) {
      const hasChildren = childrenByParent.has(cat.id);
      const isGroupByIcon = cat.icon === 'Folder';
      
      if (hasChildren || isGroupByIcon) {
        // This is a group (with or without children)
        const children = childrenByParent.get(cat.id) || [];
        children.sort((a, b) => {
          const orderA = a.sort_order ?? 0;
          const orderB = b.sort_order ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });
        groups.push({
          group: cat,
          children
        });
      } else {
        // Regular ungrouped category
        topLevelCats.push(cat);
      }
    }
  });

  // Sort ungrouped by sort_order then name
  topLevelCats.sort((a, b) => {
    const orderA = a.sort_order ?? 0;
    const orderB = b.sort_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  if (topLevelCats.length > 0) {
    groups.unshift({
      group: null,
      children: topLevelCats
    });
  }

  // Sort groups by sort_order then name
  return groups.sort((a, b) => {
    if (!a.group) return -1;
    if (!b.group) return 1;
    const orderA = a.group.sort_order ?? 0;
    const orderB = b.group.sort_order ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.group.name.localeCompare(b.group.name);
  });
}

export function CategorySearchSelect({
  value,
  onChange,
  onCreateCategory,
  incomeCategories,
  expenseCategories,
  getCategoryName,
  getCategoryColor,
  isUncategorized = !value,
  className,
  triggerClassName,
}: CategorySearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const categoryColor = getCategoryColor(value);

  // Get grouped categories
  const incomeGroups = useMemo(() => getGroupedCategories(incomeCategories), [incomeCategories]);
  const expenseGroups = useMemo(() => getGroupedCategories(expenseCategories), [expenseCategories]);

  // Filter categories based on search
  const filterGroups = (groups: CategoryGroup[]): CategoryGroup[] => {
    if (!search) return groups;
    const lowerSearch = search.toLowerCase();
    
    return groups.map(group => {
      const filteredChildren = group.children.filter(cat => 
        cat.name.toLowerCase().includes(lowerSearch)
      );
      const groupMatches = group.group?.name.toLowerCase().includes(lowerSearch);
      
      // Show all children if group name matches, otherwise only matching children
      return {
        group: group.group,
        children: groupMatches ? group.children : filteredChildren
      };
    }).filter(group => group.children.length > 0 || (group.group && group.group.name.toLowerCase().includes(lowerSearch)));
  };

  const filteredIncomeGroups = useMemo(() => filterGroups(incomeGroups), [incomeGroups, search]);
  const filteredExpenseGroups = useMemo(() => filterGroups(expenseGroups), [expenseGroups, search]);

  const hasResults = filteredIncomeGroups.length > 0 || filteredExpenseGroups.length > 0;

  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId);
    setOpen(false);
    setSearch('');
  };

  const handleCreateCategory = () => {
    onCreateCategory?.();
    setOpen(false);
    setSearch('');
  };

  // Render a category item
  const renderCategoryItem = (cat: Category, isChild: boolean = false) => (
    <CommandItem
      key={cat.id}
      value={cat.id}
      onSelect={() => handleSelect(cat.id)}
      className={cn(isChild && "pl-6")}
    >
      {isChild && <ChevronRight className="w-3 h-3 mr-1 text-muted-foreground" />}
      <div
        className="mr-2 h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: cat.color }}
      />
      <span className="truncate flex-1">{cat.name}</span>
      {value === cat.id && (
        <Check className="ml-2 h-4 w-4 shrink-0" />
      )}
    </CommandItem>
  );

  // Render grouped categories
  const renderGroupedCategories = (groups: CategoryGroup[]) => {
    return groups.map((group, idx) => {
      if (!group.group) {
        // Ungrouped categories
        return group.children.map(cat => renderCategoryItem(cat, false));
      }
      
      // Group with children
      return (
        <div key={group.group.id}>
          {/* Group header - not selectable */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: group.group.color }}
            />
            {group.group.name}
          </div>
          {/* Children */}
          {group.children.map(cat => renderCategoryItem(cat, true))}
        </div>
      );
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-9",
            isUncategorized && "bg-warning/20 border-warning text-warning dark:bg-warning/10",
            triggerClassName
          )}
        >
          {isUncategorized ? (
            <span>Sélect. catégorie</span>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: categoryColor }}
              />
              <span className="truncate">{getCategoryName(value)}</span>
            </div>
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[280px] p-0 bg-popover", className)} align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Rechercher une catégorie..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Aucune catégorie trouvée</CommandEmpty>
            
            {/* Create new category option */}
            {onCreateCategory && (
              <>
                <CommandGroup>
                  <CommandItem
                    onSelect={handleCreateCategory}
                    className="text-primary"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Créer une catégorie
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Remove category option */}
            {value && (
              <>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => handleSelect(null)}
                    className="text-muted-foreground"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Retirer la catégorie
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Income categories */}
            {filteredIncomeGroups.length > 0 && (
              <CommandGroup heading="Encaissements">
                {renderGroupedCategories(filteredIncomeGroups)}
              </CommandGroup>
            )}

            {/* Expense categories */}
            {filteredExpenseGroups.length > 0 && (
              <>
                {filteredIncomeGroups.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Décaissements">
                  {renderGroupedCategories(filteredExpenseGroups)}
                </CommandGroup>
              </>
            )}

            {/* No results but search is active */}
            {!hasResults && search && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Aucune catégorie "{search}"
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
