import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  appendDecisionNote,
  fetchNotesForDecision,
  type DecisionNote,
} from "@/services/decisionService";

export type { DecisionNote };

export function useDecisionNotes(decisionId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["decision-notes", decisionId ?? null];

  const { data: notes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchNotesForDecision(supabase, decisionId as string),
    enabled: !!decisionId,
  });

  const appendNote = useMutation({
    mutationFn: (note: string) =>
      appendDecisionNote(supabase, decisionId as string, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // appendDecisionNote bumps the parent's updated_at, so the decisions
      // list re-sorts — keep it fresh.
      queryClient.invalidateQueries({ queryKey: ["decisions"] });
    },
  });

  return { notes, isLoading, appendNote };
}
