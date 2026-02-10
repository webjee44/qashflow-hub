import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Link2 } from 'lucide-react';
import type { PennylaneCredentials } from '@/hooks/useAccountingConnector';

interface PennylaneConfigFormProps {
  onTest: (credentials: PennylaneCredentials) => Promise<boolean>;
  onSave: (credentials: PennylaneCredentials) => Promise<boolean>;
  isTesting: boolean;
  isSaving: boolean;
  onSuccess?: () => void;
}

export function PennylaneConfigForm({ 
  onTest, 
  onSave, 
  isTesting, 
  isSaving,
  onSuccess,
}: PennylaneConfigFormProps) {
  const [credentials, setCredentials] = useState<PennylaneCredentials>({
    apiKey: '',
  });
  const [testPassed, setTestPassed] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({ apiKey: e.target.value });
    setTestPassed(false);
  };

  const handleTest = async () => {
    const success = await onTest(credentials);
    setTestPassed(success);
  };

  const handleSave = async () => {
    const success = await onSave(credentials);
    if (success && onSuccess) {
      onSuccess();
    }
  };

  const isValid = credentials.apiKey.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Comment obtenir votre clé API ?</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Connectez-vous à <span className="font-medium">app.pennylane.com</span></li>
          <li>Allez dans <span className="font-medium">Paramètres → Intégrations → API</span></li>
          <li>Cliquez sur <span className="font-medium">Générer un Token API</span></li>
          <li>Cochez en <span className="font-medium">Lecture seule</span> : <span className="font-medium">Factures client</span> et <span className="font-medium">Factures fournisseurs</span></li>
          <li>Validez et copiez le token généré</li>
        </ol>
      </div>

      <div className="space-y-2">
        <Label htmlFor="pennylane-apikey">Clé API Pennylane</Label>
        <Input
          id="pennylane-apikey"
          type="password"
          placeholder="••••••••••••••••"
          value={credentials.apiKey}
          onChange={handleChange}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={!isValid || isTesting || isSaving}
          className="flex-1"
        >
          {isTesting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Test en cours...
            </>
          ) : testPassed ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
              Connexion OK
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4 mr-2" />
              Tester la connexion
            </>
          )}
        </Button>

        <Button
          type="button"
          onClick={handleSave}
          disabled={!isValid || !testPassed || isSaving}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </div>
    </div>
  );
}
