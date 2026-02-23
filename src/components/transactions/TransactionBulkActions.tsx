import { memo } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Tag, EyeOff, Eye, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TabFilter } from './hooks/useTransactionFilters';

interface TransactionBulkActionsProps {
  selectedCount: number;
  tabFilter: TabFilter;
  isBulkUpdating: boolean;
  isBulkIgnoring: boolean;
  onCategorize: () => void;
  onIgnore: (isIgnored: boolean) => void;
  onClear: () => void;
}

export const TransactionBulkActions = memo(function TransactionBulkActions({
  selectedCount, tabFilter, isBulkUpdating, isBulkIgnoring,
  onCategorize, onIgnore, onClear,
}: TransactionBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-xl"
    >
      <div className="flex items-center gap-2">
        <CheckSquare className="w-5 h-5 text-primary" />
        <span className="font-medium text-sm">
          {selectedCount} transaction{selectedCount > 1 ? 's' : ''} sélectionnée{selectedCount > 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex-1" />
      <Button size="sm" className="gap-2" disabled={isBulkUpdating} onClick={onCategorize}>
        {isBulkUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
        Catégoriser
      </Button>
      {tabFilter === 'ignored' ? (
        <Button size="sm" variant="outline" className="gap-2" disabled={isBulkIgnoring} onClick={() => onIgnore(false)}>
          {isBulkIgnoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Restaurer
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="gap-2" disabled={isBulkIgnoring} onClick={() => onIgnore(true)}>
          {isBulkIgnoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
          Ignorer
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
        <X className="w-4 h-4" />
        Annuler
      </Button>
    </motion.div>
  );
});
