import { memo } from 'react';
import { motion } from 'framer-motion';
import { List, CheckCircle2, CircleDashed, EyeOff } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TabFilter } from './hooks/useTransactionFilters';

interface TransactionTabsFilterProps {
  tabFilter: TabFilter;
  onTabChange: (tab: TabFilter) => void;
  tabCounts: { all: number; categorized: number; uncategorized: number; ignored: number };
}

export const TransactionTabsFilter = memo(function TransactionTabsFilter({
  tabFilter,
  onTabChange,
  tabCounts,
}: TransactionTabsFilterProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      <Tabs value={tabFilter} onValueChange={(v) => onTabChange(v as TabFilter)}>
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex h-12 p-1 bg-muted/80">
          <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Tous</span>
            <span className="sm:hidden">Tous</span>
            <Badge variant="outline" className="ml-1 text-xs bg-background/50">{tabCounts.all.toLocaleString('fr-FR')}</Badge>
          </TabsTrigger>
          <TabsTrigger value="categorized" className="gap-2 data-[state=active]:bg-success data-[state=active]:text-success-foreground">
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">Catégorisé</span>
            <span className="sm:hidden">Catég.</span>
            <Badge variant="outline" className="ml-1 text-xs bg-background/50">{tabCounts.categorized.toLocaleString('fr-FR')}</Badge>
          </TabsTrigger>
          <TabsTrigger value="uncategorized" className="gap-2 data-[state=active]:bg-warning data-[state=active]:text-warning-foreground">
            <CircleDashed className="w-4 h-4" />
            <span className="hidden sm:inline">Non catégorisé</span>
            <span className="sm:hidden">Non cat.</span>
            {tabCounts.uncategorized > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">{tabCounts.uncategorized.toLocaleString('fr-FR')}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ignored" className="gap-2 data-[state=active]:bg-muted-foreground data-[state=active]:text-background">
            <EyeOff className="w-4 h-4" />
            <span className="hidden sm:inline">Ignoré</span>
            <span className="sm:hidden">Ign.</span>
            {tabCounts.ignored > 0 && (
              <Badge variant="outline" className="ml-1 text-xs bg-background/50">{tabCounts.ignored.toLocaleString('fr-FR')}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </motion.div>
  );
});
