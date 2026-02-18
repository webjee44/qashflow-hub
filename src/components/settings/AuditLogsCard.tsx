import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuditLogs, formatActionLabel, formatTableName } from '@/hooks/useAuditLogs';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { History, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';

export function AuditLogsCard() {
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  const { logs, isLoading, refetch } = useAuditLogs({
    table_name: tableFilter !== 'all' ? tableFilter : undefined,
    action: actionFilter !== 'all' ? actionFilter : undefined,
    limit: 50,
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-data', {
        body: {},
      });

      if (error) throw error;

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export téléchargé avec succès');
    } catch (error) {
      logError('Export error:', error);
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'DELETE':
      case 'SOFT_DELETE':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'RESTORE':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'EXPORT':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Journal d'audit</CardTitle>
              <CardDescription>
                Historique des modifications de vos données
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Export...' : 'Exporter les données'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Toutes les tables" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les tables</SelectItem>
              <SelectItem value="organizations">Organisations</SelectItem>
              <SelectItem value="companies">Sociétés</SelectItem>
              <SelectItem value="transactions">Transactions</SelectItem>
              <SelectItem value="categories">Catégories</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Toutes les actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              <SelectItem value="INSERT">Créations</SelectItem>
              <SelectItem value="UPDATE">Modifications</SelectItem>
              <SelectItem value="SOFT_DELETE">Suppressions</SelectItem>
              <SelectItem value="RESTORE">Restaurations</SelectItem>
              <SelectItem value="EXPORT">Exports</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs list */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Chargement...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Aucun événement trouvé
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getActionColor(log.action)}>
                        {formatActionLabel(log.action)}
                      </Badge>
                      <span className="text-sm font-medium">
                        {formatTableName(log.table_name)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      ID: {log.record_id.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {format(new Date(log.created_at), 'dd MMM yyyy', { locale: fr })}
                    <br />
                    {format(new Date(log.created_at), 'HH:mm:ss', { locale: fr })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}