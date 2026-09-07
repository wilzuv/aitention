import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  createDecision as createDecisionService,
  deleteDecision as deleteDecisionService,
  fetchDecisions,
  updateDecision as updateDecisionService,
  type CreateDecisionInput,
  type Decision,
  type FetchDecisionsOptions,
  type UpdateDecisionPatch,
} from "@/services/decisionService";

export type { Decision };

export function useDecisions(opts: FetchDecisionsOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = ["decisions", opts.status ?? "all", opts.limit ?? null];

  const { data: decisions = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchDecisions(supabase, opts),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["decisions"] });

  const createDecision = useMutation({
    mutationFn: (input: CreateDecisionInput) =>
      createDecisionService(supabase, input),
    onSuccess: invalidate,
  });

  const updateDecision = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateDecisionPatch }) =>
      updateDecisionService(supabase, id, patch),
    onSuccess: invalidate,
  });

  const deleteDecision = useMutation({
    mutationFn: (id: string) => deleteDecisionService(supabase, id),
    onSuccess: invalidate,
  });

  return { decisions, isLoading, createDecision, updateDecision, deleteDecision };
}
