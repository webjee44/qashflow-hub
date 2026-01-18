import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBPRevenueStreams } from '@/hooks/useBPRevenueStreams';
import { useBPFixedExpenses } from '@/hooks/useBPFixedExpenses';
import { useBPPersonnel } from '@/hooks/useBPPersonnel';
import { useBPInvestments } from '@/hooks/useBPInvestments';
import { useBPFinancings } from '@/hooks/useBPFinancings';
import { useBPSettings } from '@/hooks/useBPSettings';

export interface BPSnapshot {
  id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  snapshot_data: {
    revenue_streams: any[];
    fixed_expenses: any[];
    personnel: any[];
    investments: any[];
    financings: any[];
    settings: any;
    created_at: string;
  };
  created_at: string;
}

export function useBPSnapshots() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current data for snapshot
  const { streams: revenueStreams } = useBPRevenueStreams();
  const { expenses: fixedExpenses } = useBPFixedExpenses();
  const { personnel } = useBPPersonnel();
  const { investments } = useBPInvestments();
  const { financings } = useBPFinancings();
  const { settings } = useBPSettings();

  // Fetch snapshots
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['bp_snapshots', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('bp_snapshots')
        .select('*')
        .order('created_at', { ascending: false });

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BPSnapshot[];
    },
    enabled: !!user,
  });

  // Create snapshot
  const createSnapshot = useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const snapshotData = {
        revenue_streams: revenueStreams,
        fixed_expenses: fixedExpenses,
        personnel: personnel,
        investments: investments,
        financings: financings,
        settings: settings,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('bp_snapshots')
        .insert([{
          user_id: user.id,
          company_id: currentCompany?.id || null,
          name,
          description: description || null,
          snapshot_data: snapshotData as unknown as any,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_snapshots'] });
      toast({ title: 'Snapshot créé', description: 'Version sauvegardée avec succès' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Delete snapshot
  const deleteSnapshot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bp_snapshots')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_snapshots'] });
      toast({ title: 'Snapshot supprimé' });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  // Compare two snapshots or snapshot vs current
  const compareSnapshots = (snapshot1: BPSnapshot, snapshot2?: BPSnapshot) => {
    const data1 = snapshot1.snapshot_data;
    const data2 = snapshot2?.snapshot_data || {
      revenue_streams: revenueStreams,
      fixed_expenses: fixedExpenses,
      personnel: personnel,
      investments: investments,
      financings: financings,
      settings: settings,
      created_at: new Date().toISOString(),
    };

    // Calculate totals for comparison
    const calcTotal = (items: any[], field: string) => 
      items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);

    return {
      version1: {
        label: snapshot1.name,
        date: snapshot1.created_at,
        totalRevenue: calcTotal(data1.revenue_streams, 'monthly_price'),
        totalFixedExpenses: calcTotal(data1.fixed_expenses, 'monthly_amount'),
        totalPersonnel: calcTotal(data1.personnel, 'gross_salary'),
        totalInvestments: calcTotal(data1.investments, 'purchase_amount'),
      },
      version2: {
        label: snapshot2?.name || 'Actuel',
        date: snapshot2?.created_at || new Date().toISOString(),
        totalRevenue: calcTotal(data2.revenue_streams, 'monthly_price'),
        totalFixedExpenses: calcTotal(data2.fixed_expenses, 'monthly_amount'),
        totalPersonnel: calcTotal(data2.personnel, 'gross_salary'),
        totalInvestments: calcTotal(data2.investments, 'purchase_amount'),
      },
    };
  };

  return {
    snapshots,
    isLoading,
    createSnapshot,
    deleteSnapshot,
    compareSnapshots,
  };
}
