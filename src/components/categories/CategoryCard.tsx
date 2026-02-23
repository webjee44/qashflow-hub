import { useState } from 'react';
import { motion } from 'framer-motion';
import { Edit3, Trash2, TrendingUp, TrendingDown, Lock } from 'lucide-react';
import { Category } from '@/hooks/useCategories';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';

interface CategoryCardProps {
  category: Category;
  index: number;
  allCategories: Category[];
  transactionCount: number;
  onEdit: (category: Category) => void;
  onDelete: (id: string, reassignToId: string | null) => void;
}

export function CategoryCard({ 
  category, 
  index, 
  allCategories,
  transactionCount,
  onEdit, 
  onDelete 
}: CategoryCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDeleteConfirm = (reassignToId: string | null) => {
    onDelete(category.id, reassignToId);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 * index }}
        className="group bg-card rounded-xl border border-border p-4 hover:shadow-lg transition-all duration-200"
      >
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${category.color}20` }}
          >
            <div 
              className="w-6 h-6 rounded-full"
              style={{ backgroundColor: category.color }}
            />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-foreground">{category.name}</h4>
              {category.is_system && (
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {category.type === 'income' ? (
                <span className="flex items-center gap-1 text-xs text-success">
                  <TrendingUp className="w-3 h-3" />
                  Revenu
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <TrendingDown className="w-3 h-3" />
                  Dépense
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                • TVA {(category.vat_rate * 100).toFixed(category.vat_rate * 100 % 1 === 0 ? 0 : 1)}%
              </span>
              {transactionCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  • {transactionCount} transaction{transactionCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => onEdit(category)}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            {!category.is_system && (
              <button 
                onClick={() => setDeleteDialogOpen(true)}
                className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <DeleteCategoryDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        category={category}
        allCategories={allCategories}
        transactionCount={transactionCount}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
