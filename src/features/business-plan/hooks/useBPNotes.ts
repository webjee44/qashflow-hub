import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface BPNote {
  id: string;
  user_id: string;
  company_id: string | null;
  section: string;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export type BPSection = 
  | 'executive_summary'
  | 'revenue'
  | 'expenses'
  | 'personnel'
  | 'investments'
  | 'financing'
  | 'pnl'
  | 'balance_sheet'
  | 'cash_flow'
  | 'scenarios'
  | 'ratios'
  | 'funding_plan'
  | 'stocks'
  | 'team';

export function useBPNotes() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['bp_notes', currentCompany?.id],
    queryFn: async () => {
      let query = supabase
        .from('bp_notes')
        .select('*');

      if (currentCompany?.id) {
        query = query.eq('company_id', currentCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as BPNote[];
    },
    enabled: !!user,
  });

  const getNote = (section: BPSection): string => {
    const note = notes.find(n => n.section === section);
    return note?.content || '';
  };

  const saveNote = useMutation({
    mutationFn: async ({ section, content }: { section: BPSection; content: string }) => {
      if (!user) throw new Error('Not authenticated');

      const existingNote = notes.find(n => n.section === section);

      if (existingNote) {
        const { error } = await supabase
          .from('bp_notes')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', existingNote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bp_notes')
          .insert({
            user_id: user.id,
            company_id: currentCompany?.id || null,
            section,
            content,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_notes'] });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (section: BPSection) => {
      const note = notes.find(n => n.section === section);
      if (!note) return;

      const { error } = await supabase
        .from('bp_notes')
        .delete()
        .eq('id', note.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bp_notes'] });
    },
    onError: (error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  return {
    notes,
    isLoading,
    getNote,
    saveNote,
    deleteNote,
  };
}
