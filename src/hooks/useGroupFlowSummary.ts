import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  getLinkedTransactionIds,
  type LinkForNeutralization,
} from '@/features/intercompany/engine/getLinkedTransactionIds';

export interface GroupFlowSummary {
  from: string;
  to: string;
  grossInflow: number;
  grossOutflow: number;
  grossNet: number;
  neutralizedInflow: number;
  neutralizedOutflow: number;
  neutralizedNet: number;
  neutralizedVolume: number; // somme des montants interco neutralisés (jambes)
  neutralizedCount: number; // nb de jambes neutralisées
}

/**
 * useGroupFlowSummary — flux consolidés sur une fenêtre glissante.
 *
 * Ne touche PAS aux trésoreries par société : agrégat purement consolidé.
 * La neutralisation ne modifie jamais les transactions ; elle exclut du
 * consolidé les jambes des liens intercompany auto_matched/confirmed.
 */
export function useGroupFlowSummary(
  companyIds: string[],
  days = 30,
) {
  const key = companyIds.slice().sort().join(',');

  return useQuery({
    queryKey: ['group_flow_summary', key, days],
    enabled: companyIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<GroupFlowSummary> => {
      const to = new Date();
      const from = new Date(to.getTime() - days * 86_400_000);
      const fromISO = from.toISOString().slice(0, 10);
      const toISO = to.toISOString().slice(0, 10);

      // Charger toutes les transactions du groupe sur la période (paginé).
      const all: Array<{ id: string; type: string; amount: number }> = [];
      const pageSize = 1000;
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, type, amount')
          .in('company_id', companyIds)
          .is('deleted_at', null)
          .or('is_ignored.is.null,is_ignored.eq.false')
          .gte('date', fromISO)
          .lte('date', toISO)
          .order('date', { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const rows = data ?? [];
        for (const r of rows) all.push({ id: r.id, type: r.type as string, amount: Number(r.amount) });
        if (rows.length < pageSize) break;
        offset += pageSize;
      }

      // Charger les liens actifs (auto+confirmed).
      const { data: links, error: lErr } = await supabase
        .from('intercompany_links')
        .select('tx_out_id, tx_in_id, status')
        .in('status', ['auto_matched', 'confirmed']);
      if (lErr) throw lErr;
      const neutralized = getLinkedTransactionIds(
        (links ?? []) as unknown as LinkForNeutralization[],
      );

      let grossInflow = 0;
      let grossOutflow = 0;
      let neutralizedInflow = 0;
      let neutralizedOutflow = 0;
      let neutralizedVolume = 0;
      let neutralizedCount = 0;

      for (const t of all) {
        const amt = Math.abs(t.amount);
        const isIn = t.type === 'income';
        const isOut = t.type === 'expense';
        if (!isIn && !isOut) continue;

        if (isIn) grossInflow += amt;
        else grossOutflow += amt;

        if (neutralized.has(t.id)) {
          neutralizedCount += 1;
          neutralizedVolume += amt;
        } else {
          if (isIn) neutralizedInflow += amt;
          else neutralizedOutflow += amt;
        }
      }

      return {
        from: fromISO,
        to: toISO,
        grossInflow,
        grossOutflow,
        grossNet: grossInflow - grossOutflow,
        neutralizedInflow,
        neutralizedOutflow,
        neutralizedNet: neutralizedInflow - neutralizedOutflow,
        neutralizedVolume,
        neutralizedCount,
      };
    },
  });
}
