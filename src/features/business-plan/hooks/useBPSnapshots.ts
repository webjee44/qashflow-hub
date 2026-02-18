// ============================================
// useBPSnapshots Hook
// Uses snapshotApi for data operations
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useBPRevenueStreams } from '@/hooks/useBPRevenueStreams';
import { useBPFixedExpenses } from '@/hooks/useBPFixedExpenses';
import { useBPPersonnel } from '@/hooks/useBPPersonnel';
import { useBPInvestments } from '@/hooks/useBPInvestments';
import { useBPFinancings } from '@/hooks/useBPFinancings';
import { useBPSettings } from '@/hooks/useBPSettings';
import { snapshotApi, type BPSnapshot } from '../api';

export type { BPSnapshot };

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
      if (currentCompany?.id) {
        return snapshotApi.getByCompanyId(currentCompany.id);
      }
      return snapshotApi.getAll();
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

      return snapshotApi.create({
        userId: user.id,
        companyId: currentCompany?.id || null,
        name,
        description: description || null,
        snapshotData,
      });
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
      await snapshotApi.delete(id);
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
