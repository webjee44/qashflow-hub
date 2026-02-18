import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, HardDrive, RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logError } from '@/lib/logger';

interface ExportFile {
  id: string;
  name: string;
  created_at: string;
  metadata: {
    size?: number;
    mimetype?: string;
  };
}

export function DataExportsCard() {
  const { currentOrganization } = useOrganization();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { data: exports = [], isLoading, refetch } = useQuery({
    queryKey: ['data-exports', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase.storage
        .from('data-exports')
        .list(currentOrganization.id, {
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) throw error;
      return (data || []) as ExportFile[];
    },
    enabled: !!currentOrganization?.id,
  });

  const handleDownload = async (fileName: string) => {
    if (!currentOrganization?.id) return;

    try {
      const { data, error } = await supabase.storage
        .from('data-exports')
        .download(`${currentOrganization.id}/${fileName}`);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export téléchargé');
    } catch (error) {
      logError('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!currentOrganization?.id) return;

    setIsDeleting(fileName);
    try {
      const { error } = await supabase.storage
        .from('data-exports')
        .remove([`${currentOrganization.id}/${fileName}`]);

      if (error) throw error;

      await refetch();
      toast.success('Export supprimé');
    } catch (error) {
      logError('Delete error:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsDeleting(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getExportType = (fileName: string) => {
    if (fileName.includes('weekly')) return 'Hebdomadaire';
    if (fileName.includes('manual')) return 'Manuel';
    return 'Export';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Exports automatiques</CardTitle>
              <CardDescription>
                Vos sauvegardes hebdomadaires (dimanche 3h UTC)
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Chargement...
            </div>
          ) : exports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <HardDrive className="h-8 w-8 mb-2 opacity-50" />
              <p>Aucun export disponible</p>
              <p className="text-xs mt-1">Le premier export aura lieu dimanche prochain</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exports.map((file) => (
                <div
                  key={file.id || file.name}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {getExportType(file.name)}
                      </Badge>
                      <span className="font-medium text-sm truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(file.metadata?.size)}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(file.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                      <span>•</span>
                      <span>{format(new Date(file.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file.name)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Télécharger
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(file.name)}
                      disabled={isDeleting === file.name}
                    >
                      {isDeleting === file.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="font-medium mb-1">💡 Fonctionnement des exports automatiques</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Export automatique chaque dimanche à 3h00 UTC</li>
            <li>Conservation des 4 dernières sauvegardes</li>
            <li>Inclut transactions, catégories, prévisions et données BP</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}