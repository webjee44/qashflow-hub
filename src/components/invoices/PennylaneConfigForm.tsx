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
      <div className="space-y-2">
        <Label htmlFor="pennylane-apikey">Clé API Pennylane</Label>
        <Input
          id="pennylane-apikey"
          type="password"
          placeholder="••••••••••••••••"
          value={credentials.apiKey}
          onChange={handleChange}
        />
        <p className="text-xs text-muted-foreground">
          Générez votre clé API dans Pennylane : Paramètres → Intégrations → API
        </p>
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
