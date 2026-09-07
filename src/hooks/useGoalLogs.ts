import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLogsForGoal,
  insertGoalLog,
  type GoalLog,
} from "@/services/goalService";

export type { GoalLog };

export function useGoalLogs(goalId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["goal-logs", goalId ?? null];

  const { data: logs = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchLogsForGoal(supabase, goalId as string),
    enabled: !!goalId,
  });

  const insertLog = useMutation({
    mutationFn: (input: { goal_id: string; note: string; logged_at?: string }) =>
      insertGoalLog(supabase, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["goal-logs", goalId ?? null] }),
  });

  return { logs, isLoading, insertLog };
}
