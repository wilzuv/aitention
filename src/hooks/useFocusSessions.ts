// src/hooks/useFocusSessions.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as focusSessionService from "@/services/focusSessionService";

export function useFocusSessions(date: string) {
  const queryClient = useQueryClient();
  const queryKey = ["focus_sessions", date];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["focus_sessions", date] });
    queryClient.invalidateQueries({ queryKey: ["focus_sessions_unclosed"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const { data: sessions, isLoading } = useQuery({
    queryKey,
    queryFn: () => focusSessionService.fetchSessions(supabase, date),
  });

  /** The single unclosed session (ended_at IS NULL) across all dates, if any. */
  const { data: unclosedSession } = useQuery({
    queryKey: ["focus_sessions_unclosed"],
    queryFn: () => focusSessionService.fetchUnclosedSession(supabase),
  });

  const createSession = useMutation({
    mutationFn: (input: {
      taskIds: string[];
      preSessionNotes?: string;
      startedAt?: string;
      entryDate?: string;
      skipActiveCheck?: boolean;
    }) => focusSessionService.createSession(supabase, date, input),
    onSuccess: (_result, input) => {
      invalidate();
      if (input.entryDate && input.entryDate !== date) {
        queryClient.invalidateQueries({ queryKey: ["focus_sessions", input.entryDate] });
      }
    },
  });

  const completeSession = useMutation({
    mutationFn: (input: {
      id: string;
      durationMinutes: number;
      postSessionNotes?: string;
      enjoymentRating?: number;
      // Optional: used only for cross-date query invalidation when the
      // session being completed is scoped to a different date than this hook.
      entryDate?: string;
    }) => {
      const { entryDate: _ignored, ...serviceInput } = input;
      return focusSessionService.completeSession(supabase, serviceInput);
    },
    onSuccess: (_result, input) => {
      invalidate();
      if (input.entryDate && input.entryDate !== date) {
        queryClient.invalidateQueries({ queryKey: ["focus_sessions", input.entryDate] });
      }
    },
  });

  const updateSession = useMutation({
    mutationFn: (input: {
      id: string;
      fields: Partial<{
        duration_minutes: number;
        pre_session_notes: string;
        post_session_notes: string;
        enjoyment_rating: number;
        started_at: string;
      }>;
    }) => focusSessionService.updateSession(supabase, input.id, input.fields),
    onSuccess: invalidate,
  });

  const deleteSession = useMutation({
    mutationFn: (id: string) => focusSessionService.deleteSession(supabase, id),
    onSuccess: invalidate,
  });

  const linkTask = useMutation({
    mutationFn: (input: {
      sessionId: string;
      taskId: string;
      linkedWhen: "before" | "after";
    }) => focusSessionService.linkTask(supabase, input),
    onSuccess: invalidate,
  });

  return {
    sessions: sessions ?? [],
    isLoading,
    unclosedSession: unclosedSession ?? null,
    createSession,
    completeSession,
    updateSession,
    deleteSession,
    linkTask,
  };
}
