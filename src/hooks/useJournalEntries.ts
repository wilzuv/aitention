// src/hooks/useJournalEntries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { JournalEntry } from "@/types/daily";
import { truncate, undoToast, toastTitle, findInCache } from "@/lib/undoToast";
import * as journalService from "@/services/journalService";

interface UseJournalEntriesOptions {
  onOpenNote?: (id: string, content: string) => void;
}

export function useJournalEntries(date: string, opts: UseJournalEntriesOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = ["journal_entries", date];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["journal_entries"] });

  const { data: journalEntries, isLoading } = useQuery({
    queryKey,
    queryFn: () => journalService.fetchJournalEntries(supabase, date),
  });

  const addFreeEntry = useMutation({
    mutationFn: (input: { content: string }) =>
      journalService.addFreeEntry(supabase, date, input.content),
    onSuccess: (created) => {
      invalidate();
      const display = `"${truncate(created.content)}"`;
      undoToast({
        title: toastTitle(
          display,
          "added",
          opts.onOpenNote ? () => opts.onOpenNote!(created.id, created.content) : undefined,
        ),
        onUndo: () => {
          supabase.from("journal_entries").delete().eq("id", created.id).then(() => invalidate());
        },
      });
    },
  });

  const updateEntry = useMutation({
    mutationFn: (input: { id: string; content: string }) =>
      journalService.updateEntry(supabase, input.id, input.content),
    onSuccess: invalidate,
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => journalService.deleteEntry(supabase, id),
    onMutate: (id: string) => ({
      deleted: findInCache<JournalEntry>(queryClient, ["journal_entries"], id),
    }),
    onSuccess: (_, __, context) => {
      invalidate();
      const deleted = context?.deleted;
      if (!deleted) return;
      undoToast({
        title: `"${truncate(deleted.content)}" deleted`,
        onUndo: () => {
          supabase
            .from("journal_entries")
            .insert({
              entry_date: deleted.entry_date,
              content: deleted.content,
              created_at: deleted.created_at,
              updated_at: deleted.updated_at,
            })
            .then(() => invalidate());
        },
      });
    },
  });

  return {
    journalEntries: journalEntries ?? [],
    isLoading,
    addFreeEntry,
    updateEntry,
    deleteEntry,
  };
}
