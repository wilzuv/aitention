import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  createExperiment as createExperimentService,
  deleteExperiment as deleteExperimentService,
  fetchExperiments,
  updateExperiment as updateExperimentService,
  type CreateExperimentInput,
  type Experiment,
  type FetchExperimentsOptions,
  type UpdateExperimentPatch,
} from "@/services/experimentService";

export type { CreateExperimentInput, UpdateExperimentPatch };

export type { Experiment };

export function useExperiments(opts: FetchExperimentsOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = [
    "experiments",
    opts.status ?? "all",
    opts.hypothesis_id ?? null,
    opts.limit ?? null,
  ];

  const { data: experiments = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchExperiments(supabase, opts),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["experiments"] });

  const createExperiment = useMutation({
    mutationFn: (input: CreateExperimentInput) =>
      createExperimentService(supabase, input),
    onSuccess: invalidate,
  });

  const updateExperiment = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateExperimentPatch }) =>
      updateExperimentService(supabase, id, patch),
    onSuccess: invalidate,
  });

  const deleteExperiment = useMutation({
    mutationFn: (id: string) => deleteExperimentService(supabase, id),
    onSuccess: invalidate,
  });

  return {
    experiments,
    isLoading,
    createExperiment,
    updateExperiment,
    deleteExperiment,
  };
}
