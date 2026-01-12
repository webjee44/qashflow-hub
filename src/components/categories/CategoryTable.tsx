import { Edit3, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Category } from '@/hooks/useCategories';
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

interface CategoryTableProps {
  categories: Category[];
  type: 'income' | 'expense';
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

export function CategoryTable({ categories, type, onEdit, onDelete }: CategoryTableProps) {
  if (categories.length === 0) return null;

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
        <span className="text-xs text-muted-foreground">({categories.length})</span>
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
          {categories.map((category) => (
            <TableRow key={category.id} className="group">
              <TableCell className="py-2">
                <div 
                  className="w-6 h-6 rounded-md"
                  style={{ backgroundColor: category.color }}
                />
              </TableCell>
              <TableCell className="py-2 font-medium">{category.name}</TableCell>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
