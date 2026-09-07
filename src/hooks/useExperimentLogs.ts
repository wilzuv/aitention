import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLogsForExperiment,
  insertExperimentLog,
  type ExperimentLog,
} from "@/services/experimentService";

export type { ExperimentLog };

export function useExperimentLogs(experimentId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["experiment-logs", experimentId ?? null];

  const { data: logs = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchLogsForExperiment(supabase, experimentId as string),
    enabled: !!experimentId,
  });

  const insertLog = useMutation({
    mutationFn: (input: { experiment_id: string; note: string; logged_at?: string }) =>
      insertExperimentLog(supabase, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["experiment-logs", experimentId ?? null] }),
  });

  return { logs, isLoading, insertLog };
}
