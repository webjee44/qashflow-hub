import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, Link2 } from 'lucide-react';
import type { OdooCredentials } from '@/hooks/useAccountingConnector';

interface OdooConfigFormProps {
  onTest: (credentials: OdooCredentials) => Promise<boolean>;
  onSave: (credentials: OdooCredentials) => Promise<boolean>;
  isTesting: boolean;
  isSaving: boolean;
  onSuccess?: () => void;
}

export function OdooConfigForm({ 
  onTest, 
  onSave, 
  isTesting, 
  isSaving,
  onSuccess,
}: OdooConfigFormProps) {
  const [credentials, setCredentials] = useState<OdooCredentials>({
    url: '',
    db: '',
    username: '',
    password: '',
    apiKey: '',
  });
  const [testPassed, setTestPassed] = useState(false);

  const handleChange = (field: keyof OdooCredentials) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCredentials(prev => ({ ...prev, [field]: e.target.value }));
    setTestPassed(false); // Reset test status when credentials change
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

  const isValid = credentials.url && credentials.db && credentials.username && credentials.password && credentials.apiKey;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="odoo-url">URL du serveur Odoo</Label>
        <Input
          id="odoo-url"
          placeholder="https://mycompany.odoo.com"
          value={credentials.url}
          onChange={handleChange('url')}
        />
        <p className="text-xs text-muted-foreground">
          L'adresse de votre instance Odoo (sans /web à la fin)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="odoo-db">Nom de la base de données</Label>
        <Input
          id="odoo-db"
          placeholder="mydb"
          value={credentials.db}
          onChange={handleChange('db')}
        />
        <p className="text-xs text-muted-foreground">
          Le nom technique de votre base Odoo
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="odoo-username">Identifiant (email)</Label>
        <Input
          id="odoo-username"
          type="email"
          placeholder="admin@company.com"
          value={credentials.username}
          onChange={handleChange('username')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="odoo-password">Mot de passe Odoo</Label>
        <Input
          id="odoo-password"
          type="password"
          placeholder="••••••••••••••••"
          value={credentials.password}
          onChange={handleChange('password')}
        />
        <p className="text-xs text-muted-foreground">
          Votre mot de passe de connexion Odoo (pour l'authentification)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="odoo-apikey">Clé API</Label>
        <Input
          id="odoo-apikey"
          type="password"
          placeholder="••••••••••••••••"
          value={credentials.apiKey}
          onChange={handleChange('apiKey')}
        />
        <p className="text-xs text-muted-foreground">
          Générez une clé API dans Odoo : Préférences → Compte & Sécurité → Clés API
        </p>
      </div>

      <div className="flex flex-col gap-3 pt-4">
        <div className="flex gap-2">
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
        
        {isValid && !testPassed && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            ⚠️ Testez d'abord la connexion avant d'enregistrer
          </p>
        )}
      </div>
    </div>
  );
}
