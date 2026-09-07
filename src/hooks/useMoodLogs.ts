// src/hooks/useMoodLogs.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MoodLog, MoodContext } from "@/types/daily";
import { undoToast, toastTitle, findInCache } from "@/lib/undoToast";
import * as moodService from "@/services/moodService";

interface UseMoodLogsOptions {
  onOpenMood?: (mood: MoodLog) => void;
}

export function useMoodLogs(date: string, opts: UseMoodLogsOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = ["mood_logs", date];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["mood_logs"] });

  const { data: moodLogs, isLoading } = useQuery({
    queryKey,
    queryFn: () => moodService.fetchMoodLogs(supabase, date),
  });

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
        title: toastTitle(
          "Mood logged",
          "",
          opts.onOpenMood ? () => opts.onOpenMood!(created) : undefined,
        ),
        onUndo: () => {
          supabase.from("mood_logs").delete().eq("id", created.id).then(() => invalidate());
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
    mutationFn: (id: string) => moodService.deleteMood(supabase, id),
    onMutate: (id: string) => ({
      deleted: findInCache<MoodLog>(queryClient, ["mood_logs"], id),
    }),
    onSuccess: (_, __, context) => {
      invalidate();
      const deleted = context?.deleted;
      if (!deleted) return;
      undoToast({
        title: "Mood deleted",
        onUndo: () => {
          supabase
            .from("mood_logs")
            .insert({
              mood_rating: deleted.mood_rating,
              energy_rating: deleted.energy_rating,
              note: deleted.note,
              context: deleted.context,
              logged_at: deleted.logged_at,
            })
            .then(() => invalidate());
        },
      });
    },
  });

  return {
    moodLogs: moodLogs ?? [],
    isLoading,
    logMood,
    updateMood,
    deleteMood,
  };
}
