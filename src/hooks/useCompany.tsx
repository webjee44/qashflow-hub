import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Company {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  initial_balance: number;
  bank_balance: number | null;
  bank_balance_updated_at: string | null;
  bridge_user_uuid: string | null;
  created_at: string;
  updated_at: string;
}

interface CompanyContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  companies: Company[];
  isLoading: boolean;
  createCompany: (data: { name: string; initial_balance?: number; is_default?: boolean }) => Promise<Company>;
  updateCompany: (id: string, data: { name?: string; initial_balance?: number; is_default?: boolean }) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  restoreCompany: (id: string) => Promise<void>;
  refetch: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = 'selected_company_id';

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Fetch companies
  const { data: companies = [], isLoading, refetch } = useQuery({
    queryKey: ['companies', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .is('deleted_at', null) // Filter out soft-deleted companies
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      
      if (error) throw error;

      return (data || []) as Company[];
    },
    enabled: !!user?.id,
  });

  // Set current company from localStorage or default - runs once when companies are loaded
  useEffect(() => {
    if (companies.length > 0 && !hasInitialized) {
      const storedId = localStorage.getItem(STORAGE_KEY);
      const storedCompany = storedId ? companies.find(c => c.id === storedId) : null;
      const defaultCompany = companies.find(c => c.is_default) || companies[0];
      
      setCurrentCompanyState(storedCompany || defaultCompany);
      setHasInitialized(true);
    }
  }, [companies, hasInitialized]);

  // Keep currentCompany in sync when companies are refetched/updated
  useEffect(() => {
    if (!currentCompany || companies.length === 0) return;
    const latest = companies.find(c => c.id === currentCompany.id);
    if (!latest) return;

    // Update when server data changed (e.g. bank_balance after sync)
    if (
      latest.updated_at !== currentCompany.updated_at ||
      latest.bank_balance !== currentCompany.bank_balance ||
      latest.bank_balance_updated_at !== currentCompany.bank_balance_updated_at ||
      latest.initial_balance !== currentCompany.initial_balance ||
      latest.name !== currentCompany.name ||
      latest.is_default !== currentCompany.is_default
    ) {
      setCurrentCompanyState(latest);
    }
  }, [companies, currentCompany]);

  // Clear company when user logs out
  useEffect(() => {
    if (!user) {
      setCurrentCompanyState(null);
      setHasInitialized(false);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const setCurrentCompany = (company: Company | null) => {
    const previousCompanyId = currentCompany?.id;
    setCurrentCompanyState(company);
    
    if (company) {
      localStorage.setItem(STORAGE_KEY, company.id);
      
      // Invalidate all company-specific data when switching companies
      if (previousCompanyId && previousCompanyId !== company.id) {
        // Invalidate treasury/forecast data
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['forecasts'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
        queryClient.invalidateQueries({ queryKey: ['automationRules'] });
        
        // Invalidate Business Plan data
        queryClient.invalidateQueries({ queryKey: ['bp-settings'] });
        queryClient.invalidateQueries({ queryKey: ['bp-revenue-streams'] });
        queryClient.invalidateQueries({ queryKey: ['bp-revenue-forecasts'] });
        queryClient.invalidateQueries({ queryKey: ['bp-fixed-expenses'] });
        queryClient.invalidateQueries({ queryKey: ['bp-variable-expenses'] });
        queryClient.invalidateQueries({ queryKey: ['bp-personnel'] });
        queryClient.invalidateQueries({ queryKey: ['bp-directors'] });
        queryClient.invalidateQueries({ queryKey: ['bp-investments'] });
        queryClient.invalidateQueries({ queryKey: ['bp-financings'] });
        queryClient.invalidateQueries({ queryKey: ['bp-stocks'] });
        queryClient.invalidateQueries({ queryKey: ['bp-scenarios'] });
        queryClient.invalidateQueries({ queryKey: ['bp-notes'] });
        
        toast.info(`Contexte changé vers ${company.name}`);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Create company
  const createCompany = async (data: { name: string; initial_balance?: number; is_default?: boolean }): Promise<Company> => {
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

    await refetch();
    
    // Auto-select if first company
    if (companies.length === 0) {
      setCurrentCompany(newCompany as Company);
    }

    toast.success('Société créée avec succès');
    return newCompany as Company;
  };

  // Update company
  const updateCompany = async (id: string, data: { name?: string; initial_balance?: number; is_default?: boolean }) => {
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

  // Soft delete company (set deleted_at instead of hard delete)
  const deleteCompany = async (id: string) => {
    if (!user?.id) throw new Error('Non authentifié');

    const { error } = await supabase
      .from('companies')
      .update({ deleted_at: new Date().toISOString() })
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

  // Restore a soft-deleted company
  const restoreCompany = async (id: string) => {
    if (!user?.id) throw new Error('Non authentifié');

    const { error } = await supabase
      .from('companies')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) throw error;

    await refetch();
    toast.success('Société restaurée');
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
        restoreCompany,
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
