import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Settings2, 
  Building2, 
  FileSpreadsheet,
  Unplug,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ConnectorDialog } from './ConnectorDialog';
import type { ConnectorConfig } from '@/hooks/useAccountingConnector';

interface ConnectorStatusProps {
  config: ConnectorConfig;
  isLoading: boolean;
  isSyncing: boolean;
  isTesting: boolean;
  isSaving: boolean;
  onSync: () => Promise<boolean>;
  onDisconnect: () => Promise<boolean>;
  onTestOdoo: (credentials: any) => Promise<boolean>;
  onSaveOdoo: (credentials: any) => Promise<boolean>;
  onTestPennylane: (credentials: any) => Promise<boolean>;
  onSavePennylane: (credentials: any) => Promise<boolean>;
}

export function ConnectorStatus({
  config,
  isLoading,
  isSyncing,
  isTesting,
  isSaving,
  onSync,
  onDisconnect,
  onTestOdoo,
  onSaveOdoo,
  onTestPennylane,
  onSavePennylane,
}: ConnectorStatusProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  const getProviderIcon = () => {
    switch (config.provider) {
      case 'odoo':
        return <Building2 className="h-4 w-4" />;
      case 'pennylane':
        return <FileSpreadsheet className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getProviderName = () => {
    switch (config.provider) {
      case 'odoo':
        return 'Odoo';
      case 'pennylane':
        return 'Pennylane';
      default:
        return '';
    }
  };

  const handleDisconnect = async () => {
    await onDisconnect();
    setDisconnectDialogOpen(false);
  };

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
        Chargement...
      </Button>
    );
  }

  // Not configured - show CTA
  if (!config.isConfigured) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" />
          Connecteur Compta
        </Button>

        <ConnectorDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onTestOdoo={onTestOdoo}
          onSaveOdoo={onSaveOdoo}
          onTestPennylane={onTestPennylane}
          onSavePennylane={onSavePennylane}
          isTesting={isTesting}
          isSaving={isSaving}
        />
      </>
    );
  }

  // Configured - show status + sync button
  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {getProviderIcon()}
              <span className="hidden sm:inline">{getProviderName()}</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                Connecté
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDialogOpen(true)}>
              <Settings2 className="h-4 w-4 mr-2" />
              Reconfigurer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setDisconnectDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Unplug className="h-4 w-4 mr-2" />
              Déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="default"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Synchroniser</span>
        </Button>
      </div>

      <ConnectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onTestOdoo={onTestOdoo}
        onSaveOdoo={onSaveOdoo}
        onTestPennylane={onTestPennylane}
        onSavePennylane={onSavePennylane}
        isTesting={isTesting}
        isSaving={isSaving}
      />

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déconnecter le connecteur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les factures déjà synchronisées resteront dans votre compte, mais la synchronisation automatique sera désactivée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>
              Déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
