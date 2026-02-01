import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from './useCompany';
import { useToast } from './use-toast';

export type ConnectorProvider = 'odoo' | 'pennylane' | null;

export interface ConnectorConfig {
  provider: ConnectorProvider;
  isConfigured: boolean;
  lastSyncAt: string | null;
}

export interface OdooCredentials {
  url: string;
  db: string;
  username: string;
  password: string;
  apiKey: string;
}

export interface PennylaneCredentials {
  apiKey: string;
}

export function useAccountingConnector() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [config, setConfig] = useState<ConnectorConfig>({
    provider: null,
    isConfigured: false,
    lastSyncAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Detect which connector is configured for this company
  const detectConnector = useCallback(async () => {
    if (!currentCompany?.id) {
      setConfig({ provider: null, isConfigured: false, lastSyncAt: null });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Check for Odoo credentials (all 4 must be present)
      const { data: odooCheck } = await supabase.rpc('company_has_secret', {
        p_company_id: currentCompany.id,
        p_secret_type: 'odoo_api_key',
      });

      if (odooCheck) {
        setConfig({
          provider: 'odoo',
          isConfigured: true,
          lastSyncAt: null, // Could query invoices for last sync time
        });
        setIsLoading(false);
        return;
      }

      // Check for Pennylane
      const { data: pennylaneCheck } = await supabase.rpc('company_has_secret', {
        p_company_id: currentCompany.id,
        p_secret_type: 'pennylane_api_key',
      });

      if (pennylaneCheck) {
        setConfig({
          provider: 'pennylane',
          isConfigured: true,
          lastSyncAt: null,
        });
        setIsLoading(false);
        return;
      }

      // No connector configured
      setConfig({ provider: null, isConfigured: false, lastSyncAt: null });
    } catch (error) {
      console.error('Error detecting connector:', error);
      setConfig({ provider: null, isConfigured: false, lastSyncAt: null });
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    detectConnector();
  }, [detectConnector]);

  // Save Odoo credentials
  const saveOdooCredentials = async (credentials: OdooCredentials): Promise<boolean> => {
    if (!currentCompany?.id) return false;

    setIsSaving(true);
    try {
      const secrets = [
        { type: 'odoo_url', value: credentials.url },
        { type: 'odoo_db', value: credentials.db },
        { type: 'odoo_username', value: credentials.username },
        { type: 'odoo_password', value: credentials.password },
        { type: 'odoo_api_key', value: credentials.apiKey },
      ];

      // Delete existing secrets first
      for (const secret of secrets) {
        await supabase
          .from('company_secrets')
          .delete()
          .eq('company_id', currentCompany.id)
          .eq('secret_type', secret.type);
      }

      // Insert new secrets
      for (const secret of secrets) {
        const { error } = await supabase
          .from('company_secrets')
          .insert({
            company_id: currentCompany.id,
            secret_type: secret.type,
            encrypted_value: secret.value, // In production, encrypt this
          });

        if (error) throw error;
      }

      // Refresh config
      await detectConnector();
      
      toast({
        title: 'Configuration sauvegardée',
        description: 'Vos identifiants Odoo ont été enregistrés.',
      });

      return true;
    } catch (error) {
      console.error('Error saving Odoo credentials:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder les identifiants.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Save Pennylane credentials
  const savePennylaneCredentials = async (credentials: PennylaneCredentials): Promise<boolean> => {
    if (!currentCompany?.id) return false;

    setIsSaving(true);
    try {
      // Delete existing secret first
      await supabase
        .from('company_secrets')
        .delete()
        .eq('company_id', currentCompany.id)
        .eq('secret_type', 'pennylane_api_key');

      // Insert new secret
      const { error } = await supabase
        .from('company_secrets')
        .insert({
          company_id: currentCompany.id,
          secret_type: 'pennylane_api_key',
          encrypted_value: credentials.apiKey,
        });

      if (error) throw error;

      // Refresh config
      await detectConnector();
      
      toast({
        title: 'Configuration sauvegardée',
        description: 'Votre clé API Pennylane a été enregistrée.',
      });

      return true;
    } catch (error) {
      console.error('Error saving Pennylane credentials:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder la clé API.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Test Odoo connection
  const testOdooConnection = async (credentials: OdooCredentials): Promise<boolean> => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('accounting-connector-sync', {
        body: {
          action: 'test',
          provider: 'odoo',
          credentials,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Connexion réussie',
          description: `Connecté à Odoo en tant que ${data.username || 'utilisateur'}`,
        });
        return true;
      } else {
        throw new Error(data.error || 'Connexion échouée');
      }
    } catch (error: any) {
      console.error('Odoo test error:', error);
      toast({
        title: 'Échec de connexion',
        description: error.message || 'Impossible de se connecter à Odoo. Vérifiez vos identifiants.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  // Test Pennylane connection
  const testPennylaneConnection = async (credentials: PennylaneCredentials): Promise<boolean> => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('accounting-connector-sync', {
        body: {
          action: 'test',
          provider: 'pennylane',
          credentials,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Connexion réussie',
          description: 'Connexion à Pennylane établie.',
        });
        return true;
      } else {
        throw new Error(data.error || 'Connexion échouée');
      }
    } catch (error: any) {
      console.error('Pennylane test error:', error);
      toast({
        title: 'Échec de connexion',
        description: error.message || 'Impossible de se connecter à Pennylane.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  // Sync invoices
  const syncInvoices = async (): Promise<boolean> => {
    if (!currentCompany?.id || !config.isConfigured) return false;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('accounting-connector-sync', {
        body: {
          action: 'sync',
          company_id: currentCompany.id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Synchronisation terminée',
          description: data.message || `${data.created || 0} créées, ${data.updated || 0} mises à jour`,
        });
        return true;
      } else {
        throw new Error(data.error || 'Synchronisation échouée');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Erreur de synchronisation',
        description: error.message || 'Impossible de synchroniser les factures.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Disconnect connector
  const disconnectConnector = async (): Promise<boolean> => {
    if (!currentCompany?.id) return false;

    try {
      // Delete all connector secrets
      const secretTypes = [
        'odoo_url', 'odoo_db', 'odoo_username', 'odoo_password', 'odoo_api_key',
        'pennylane_api_key',
      ];

      for (const type of secretTypes) {
        await supabase
          .from('company_secrets')
          .delete()
          .eq('company_id', currentCompany.id)
          .eq('secret_type', type);
      }

      await detectConnector();
      
      toast({
        title: 'Connecteur déconnecté',
        description: 'Le connecteur comptable a été désactivé.',
      });

      return true;
    } catch (error) {
      console.error('Error disconnecting connector:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de déconnecter le connecteur.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    config,
    isLoading,
    isSyncing,
    isTesting,
    isSaving,
    saveOdooCredentials,
    savePennylaneCredentials,
    testOdooConnection,
    testPennylaneConnection,
    syncInvoices,
    disconnectConnector,
    refresh: detectConnector,
  };
}
