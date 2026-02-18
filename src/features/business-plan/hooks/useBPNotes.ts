// ============================================
// useBPNotes Hook
// Uses noteApi for data operations
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { noteApi, type BPNote, type BPSection } from '../api';

export type { BPNote, BPSection };

export function useBPNotes() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['bp_notes', currentCompany?.id],
    queryFn: async () => {
      if (currentCompany?.id) {
        return noteApi.getByCompanyId(currentCompany.id);
      }
      return noteApi.getAll();
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
      await noteApi.upsert({
        existingNote,
        userId: user.id,
        companyId: currentCompany?.id || null,
        section,
        content,
      });
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
      await noteApi.deleteBySection(note.id);
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
