import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  createHypothesis as createHypothesisService,
  deleteHypothesis as deleteHypothesisService,
  fetchHypotheses,
  updateHypothesis as updateHypothesisService,
  appendHypothesisEvidence as appendEvidenceService,
  type CreateHypothesisInput,
  type FetchHypothesesOptions,
  type Hypothesis,
  type UpdateHypothesisPatch,
} from "@/services/hypothesisService";

export type { Hypothesis };

export function useHypotheses(opts: FetchHypothesesOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = [
    "hypotheses",
    opts.decision_id ?? null,
    opts.archived ?? null,
    opts.search ?? null,
    opts.limit ?? null,
  ];

  const { data: hypotheses = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchHypotheses(supabase, opts),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["hypotheses"] });

  const createHypothesis = useMutation({
    mutationFn: (input: CreateHypothesisInput) =>
      createHypothesisService(supabase, input),
    onSuccess: invalidate,
  });

  const updateHypothesis = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateHypothesisPatch }) =>
      updateHypothesisService(supabase, id, patch),
    onSuccess: invalidate,
  });

  const deleteHypothesis = useMutation({
    mutationFn: (id: string) => deleteHypothesisService(supabase, id),
    onSuccess: invalidate,
  });

  const appendEvidence = useMutation({
    mutationFn: (input: { hypothesis_id: string; note: string; posterior_credence: number }) =>
      appendEvidenceService(supabase, input),
    onSuccess: invalidate,
  });

  return {
    hypotheses,
    isLoading,
    createHypothesis,
    updateHypothesis,
    deleteHypothesis,
    appendEvidence,
  };
}
