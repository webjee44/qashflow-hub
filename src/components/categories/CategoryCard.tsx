import { motion } from 'framer-motion';
import { Edit3, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Category } from '@/hooks/useCategories';
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

interface CategoryCardProps {
  category: Category;
  index: number;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

export function CategoryCard({ category, index, onEdit, onDelete }: CategoryCardProps) {
  return (
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
          <h4 className="font-semibold text-foreground">{category.name}</h4>
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
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onEdit(category)}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
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
      </div>
    </motion.div>
  );
}
