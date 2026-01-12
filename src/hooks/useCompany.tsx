import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Company {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  initial_balance: number;
  created_at: string;
  updated_at: string;
  has_pennylane_key?: boolean; // Computed from company_has_secret function
}

interface CompanyContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  companies: Company[];
  isLoading: boolean;
  createCompany: (data: { name: string; initial_balance?: number; pennylane_api_key?: string; is_default?: boolean }) => Promise<Company>;
  updateCompany: (id: string, data: { name?: string; initial_balance?: number; is_default?: boolean; pennylane_api_key?: string }) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  refetch: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = 'selected_company_id';

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null);

  // Fetch companies with secret check
  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ['companies', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      
      if (error) throw error;

      // Check if each company has a Pennylane API key configured
      const companiesWithSecretStatus = await Promise.all(
        (data || []).map(async (company) => {
          const { data: hasSecret } = await supabase.rpc('company_has_secret', {
            p_company_id: company.id,
            p_secret_type: 'pennylane_api_key'
          });
          return {
            ...company,
            has_pennylane_key: hasSecret || false
          } as Company;
        })
      );
      
      return companiesWithSecretStatus;
    },
    enabled: !!user?.id,
  });

  // Set current company from localStorage or default
  useEffect(() => {
    if (companies.length > 0 && !currentCompany) {
      const storedId = localStorage.getItem(STORAGE_KEY);
      const storedCompany = storedId ? companies.find(c => c.id === storedId) : null;
      const defaultCompany = companies.find(c => c.is_default) || companies[0];
      
      setCurrentCompanyState(storedCompany || defaultCompany);
    }
  }, [companies, currentCompany]);

  // Clear company when user logs out
  useEffect(() => {
    if (!user) {
      setCurrentCompanyState(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const setCurrentCompany = (company: Company | null) => {
    setCurrentCompanyState(company);
    if (company) {
      localStorage.setItem(STORAGE_KEY, company.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Create company with optional API key
  const createCompany = async (data: { name: string; initial_balance?: number; pennylane_api_key?: string; is_default?: boolean }): Promise<Company> => {
    if (!user?.id) throw new Error('Non authentifié');

    // If this is the first company or is_default is true, make it default
    const isDefault = data.is_default || companies.length === 0;

    // If setting as default, unset other defaults
    if (isDefault && companies.length > 0) {
      await supabase
        .from('companies')
        .update({ is_default: false })
        .eq('user_id', user.id);
    }

    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert({
        user_id: user.id,
        name: data.name,
        initial_balance: data.initial_balance || 0,
        is_default: isDefault,
      })
      .select()
      .single();

    if (error) throw error;

    // If API key provided, store it in company_secrets
    if (data.pennylane_api_key) {
      const { error: secretError } = await supabase
        .from('company_secrets')
        .insert({
          company_id: newCompany.id,
          secret_type: 'pennylane_api_key',
          encrypted_value: data.pennylane_api_key,
        });

      if (secretError) {
        console.error('Error storing API key:', secretError);
        // Don't fail the company creation, just log the error
      }
    }

    await refetch();
    
    // Auto-select if first company
    if (companies.length === 0) {
      setCurrentCompany({ ...newCompany, has_pennylane_key: !!data.pennylane_api_key } as Company);
    }

    toast.success('Société créée avec succès');
    return { ...newCompany, has_pennylane_key: !!data.pennylane_api_key } as Company;
  };

  // Update company
  const updateCompany = async (id: string, data: { name?: string; initial_balance?: number; is_default?: boolean; pennylane_api_key?: string }) => {
    if (!user?.id) throw new Error('Non authentifié');

    // If setting as default, unset other defaults
    if (data.is_default) {
      await supabase
        .from('companies')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .neq('id', id);
    }

    // Update company basic info
    const updateData: { name?: string; initial_balance?: number; is_default?: boolean } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.initial_balance !== undefined) updateData.initial_balance = data.initial_balance;
    if (data.is_default !== undefined) updateData.is_default = data.is_default;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    }

    // Handle API key update if provided
    if (data.pennylane_api_key !== undefined) {
      if (data.pennylane_api_key) {
        // Upsert the secret (insert or update)
        const { error: secretError } = await supabase
          .from('company_secrets')
          .upsert({
            company_id: id,
            secret_type: 'pennylane_api_key',
            encrypted_value: data.pennylane_api_key,
          }, {
            onConflict: 'company_id,secret_type'
          });

        if (secretError) {
          console.error('Error updating API key:', secretError);
        }
      } else {
        // Delete the secret if empty string provided
        await supabase
          .from('company_secrets')
          .delete()
          .eq('company_id', id)
          .eq('secret_type', 'pennylane_api_key');
      }
    }

    await refetch();

    // Update current company if it was the one updated
    if (currentCompany?.id === id) {
      const updated = companies.find(c => c.id === id);
      if (updated) {
        setCurrentCompany({ ...updated, ...data } as Company);
      }
    }

    toast.success('Société mise à jour');
  };

  // Delete company
  const deleteCompany = async (id: string) => {
    if (!user?.id) throw new Error('Non authentifié');

    // Secrets are deleted automatically via CASCADE
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await refetch();

    // If deleted current company, switch to another
    if (currentCompany?.id === id) {
      const remaining = companies.filter(c => c.id !== id);
      setCurrentCompany(remaining[0] || null);
    }

    toast.success('Société supprimée');
  };

  return (
    <CompanyContext.Provider
      value={{
        currentCompany,
        setCurrentCompany,
        companies,
        isLoading,
        createCompany,
        updateCompany,
        deleteCompany,
        refetch,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
