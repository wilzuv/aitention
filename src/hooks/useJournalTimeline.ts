// src/hooks/useJournalTimeline.ts
//
// React Query wrapper backing the Journal page. Fetches mood logs and journal
// entries across a date range and exposes mutations for adding, editing, and
// deleting both. Mirrors the single-date useMoodLogs / useJournalEntries hooks,
// but keyed by range so the Journal page can show history over time.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MoodLog, JournalEntry, MoodContext } from "@/types/daily";
import { truncate, undoToast } from "@/lib/undoToast";
import * as moodService from "@/services/moodService";
import * as journalService from "@/services/journalService";

export function useJournalTimeline(dateFrom: string, dateTo: string) {
  const queryClient = useQueryClient();

  // Invalidate both the range queries here and the per-day queries used by the
  // Today page, so edits stay consistent across views.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["mood_logs"] });
    queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
  };

  const moodQuery = useQuery({
    queryKey: ["mood_logs", "range", dateFrom, dateTo],
    queryFn: () => moodService.fetchMoodLogsRange(supabase, dateFrom, dateTo),
  });

  const journalQuery = useQuery({
    queryKey: ["journal_entries", "range", dateFrom, dateTo],
    queryFn: () => journalService.fetchJournalEntriesRange(supabase, dateFrom, dateTo),
  });

  // ── Mood ──────────────────────────────────────────────────────────

  const logMood = useMutation({
    mutationFn: (input: {
      mood_rating?: number;
      energy_rating?: number;
      note?: string;
      context: MoodContext;
    }) => moodService.logMood(supabase, input),
    onSuccess: (created) => {
      invalidate();
      undoToast({
        title: "Mood logged",
        onUndo: () => {
          supabase.from("mood_logs").delete().eq("id", created.id).then(invalidate);
        },
      });
    },
  });

  const updateMood = useMutation({
    mutationFn: (input: {
      id: string;
      mood_rating?: number | null;
      energy_rating?: number | null;
      note?: string | null;
    }) => moodService.updateMood(supabase, input),
    onSuccess: invalidate,
  });

  const deleteMood = useMutation({
    mutationFn: (mood: MoodLog) => moodService.deleteMood(supabase, mood.id),
    onSuccess: (_, mood) => {
      invalidate();
      undoToast({
        title: "Mood deleted",
        onUndo: () => {
          supabase
            .from("mood_logs")
            .insert({
              mood_rating: mood.mood_rating,
              energy_rating: mood.energy_rating,
              note: mood.note,
              context: mood.context,
              logged_at: mood.logged_at,
            })
            .then(invalidate);
        },
      });
    },
  });

  // ── Journal ───────────────────────────────────────────────────────

  const addEntry = useMutation({
    mutationFn: (input: { date: string; content: string }) =>
      journalService.addFreeEntry(supabase, input.date, input.content),
    onSuccess: (created) => {
      invalidate();
      undoToast({
        title: `"${truncate(created.content)}" added`,
        onUndo: () => {
          supabase.from("journal_entries").delete().eq("id", created.id).then(invalidate);
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
    mutationFn: (entry: JournalEntry) => journalService.deleteEntry(supabase, entry.id),
    onSuccess: (_, entry) => {
      invalidate();
      undoToast({
        title: `"${truncate(entry.content)}" deleted`,
        onUndo: () => {
          supabase
            .from("journal_entries")
            .insert({
              entry_date: entry.entry_date,
              content: entry.content,
              created_at: entry.created_at,
              updated_at: entry.updated_at,
            })
            .then(invalidate);
        },
      });
    },
  });

  return {
    moodLogs: moodQuery.data ?? [],
    journalEntries: journalQuery.data ?? [],
    isLoading: moodQuery.isLoading || journalQuery.isLoading,
    logMood,
    updateMood,
    deleteMood,
    addEntry,
    updateEntry,
    deleteEntry,
  };
}
