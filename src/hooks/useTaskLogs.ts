import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLogsForTask,
  insertTaskLog,
  type TaskLog,
} from "@/services/taskService";

export type { TaskLog };

export function useTaskLogs(taskId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["task-logs", taskId ?? null];

  const { data: logs = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchLogsForTask(supabase, taskId as string),
    enabled: !!taskId,
  });

  const insertLog = useMutation({
    mutationFn: (input: { task_id: string; note: string; logged_at?: string }) =>
      insertTaskLog(supabase, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["task-logs", taskId ?? null] }),
  });

  return { logs, isLoading, insertLog };
}
