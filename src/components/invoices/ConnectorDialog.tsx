import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, Building2, FileSpreadsheet } from 'lucide-react';
import { OdooConfigForm } from './OdooConfigForm';
import { PennylaneConfigForm } from './PennylaneConfigForm';
import type { ConnectorProvider } from '@/hooks/useAccountingConnector';

interface ConnectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTestOdoo: (credentials: any) => Promise<boolean>;
  onSaveOdoo: (credentials: any) => Promise<boolean>;
  onTestPennylane: (credentials: any) => Promise<boolean>;
  onSavePennylane: (credentials: any) => Promise<boolean>;
  isTesting: boolean;
  isSaving: boolean;
}

type Step = 'select' | 'configure';

const providers: { id: ConnectorProvider; name: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'odoo',
    name: 'Odoo',
    icon: <Building2 className="h-6 w-6" />,
    description: 'ERP open source (v17+)',
  },
  {
    id: 'pennylane',
    name: 'Pennylane',
    icon: <FileSpreadsheet className="h-6 w-6" />,
    description: 'Comptabilité en ligne',
  },
];

export function ConnectorDialog({
  open,
  onOpenChange,
  onTestOdoo,
  onSaveOdoo,
  onTestPennylane,
  onSavePennylane,
  isTesting,
  isSaving,
}: ConnectorDialogProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedProvider, setSelectedProvider] = useState<ConnectorProvider>(null);

  const handleSelectProvider = (provider: ConnectorProvider) => {
    setSelectedProvider(provider);
    setStep('configure');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedProvider(null);
  };

  const handleSuccess = () => {
    onOpenChange(false);
    setStep('select');
    setSelectedProvider(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setStep('select');
      setSelectedProvider(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {step === 'configure' && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
          )}
          <DialogTitle className="pt-2">
            {step === 'select' 
              ? 'Connecteur Comptable' 
              : `Configuration ${providers.find(p => p.id === selectedProvider)?.name}`
            }
          </DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Sélectionnez votre logiciel comptable pour synchroniser vos factures'
              : 'Entrez vos identifiants pour vous connecter'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="grid gap-3 py-4">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleSelectProvider(provider.id)}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-lg border-2 border-border',
                  'hover:border-primary/50 hover:bg-accent/50 transition-colors',
                  'text-left'
                )}
              >
                <div className="flex-shrink-0 p-2 rounded-md bg-primary/10 text-primary">
                  {provider.icon}
                </div>
                <div>
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {provider.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-4">
            {selectedProvider === 'odoo' && (
              <OdooConfigForm
                onTest={onTestOdoo}
                onSave={onSaveOdoo}
                isTesting={isTesting}
                isSaving={isSaving}
                onSuccess={handleSuccess}
              />
            )}
            {selectedProvider === 'pennylane' && (
              <PennylaneConfigForm
                onTest={onTestPennylane}
                onSave={onSavePennylane}
                isTesting={isTesting}
                isSaving={isSaving}
                onSuccess={handleSuccess}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
