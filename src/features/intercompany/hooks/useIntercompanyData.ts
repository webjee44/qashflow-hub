import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchIntercompanyLinks,
  fetchIntercompanyAnomalies,
  decideLinkStatus,
  triggerIncrementalMatch,
} from '../api/intercompanyApi';

const LINKS_KEY = ['intercompany-links'];
const ANOMALIES_KEY = ['intercompany-anomalies'];

export function useIntercompanyLinks() {
  return useQuery({
    queryKey: LINKS_KEY,
    queryFn: fetchIntercompanyLinks,
    staleTime: 1000 * 60,
  });
}

export function useIntercompanyAnomalies() {
  return useQuery({
    queryKey: ANOMALIES_KEY,
    queryFn: fetchIntercompanyAnomalies,
    staleTime: 1000 * 60,
  });
}

export function useDecideLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'confirmed' | 'rejected' }) =>
      decideLinkStatus(id, status),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: LINKS_KEY });
      qc.invalidateQueries({ queryKey: ANOMALIES_KEY });
      toast.success(vars.status === 'confirmed' ? 'Lien confirmé' : 'Lien rejeté');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Échec de la décision');
    },
  });
}

export function useRunIncrementalMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sinceDays?: number) => triggerIncrementalMatch(sinceDays ?? 90),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: LINKS_KEY });
      qc.invalidateQueries({ queryKey: ANOMALIES_KEY });
      if (data.status === 'error') {
        toast.error(`Appariement en erreur: ${data.error ?? 'inconnue'}`);
      } else {
        toast.success('Appariement terminé');
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Échec de l'appariement");
    },
  });
}
