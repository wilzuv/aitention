import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  createPrediction as createPredictionService,
  deletePrediction as deletePredictionService,
  fetchPredictions,
  updatePrediction as updatePredictionService,
  type CreatePredictionInput,
  type FetchPredictionsOptions,
  type Prediction,
  type UpdatePredictionPatch,
} from "@/services/predictionService";

export type { Prediction };

export function usePredictions(opts: FetchPredictionsOptions = {}) {
  const queryClient = useQueryClient();
  const queryKey = [
    "predictions",
    opts.source ?? "all",
    opts.outcome ?? "all",
    opts.limit ?? null,
  ];

  const { data: predictions = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchPredictions(supabase, opts),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["predictions"] });

  const createPrediction = useMutation({
    mutationFn: (input: CreatePredictionInput) =>
      createPredictionService(supabase, input),
    onSuccess: invalidate,
  });

  const updatePrediction = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdatePredictionPatch }) =>
      updatePredictionService(supabase, id, patch),
    onSuccess: invalidate,
  });

  const deletePrediction = useMutation({
    mutationFn: (id: string) => deletePredictionService(supabase, id),
    onSuccess: invalidate,
  });

  return {
    predictions,
    isLoading,
    createPrediction,
    updatePrediction,
    deletePrediction,
  };
}
