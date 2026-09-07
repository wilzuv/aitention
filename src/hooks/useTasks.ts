import { toast } from "@/hooks/use-toast";
// src/hooks/useTasks.ts — Thin wrapper over taskService + recurrenceService
import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { truncate, undoToast, toastTitle, findInCache } from "@/lib/undoToast";
import type { Task, ScheduleHistoryEntry } from "@/types/daily";
import * as taskService from "@/services/taskService";
import * as recurrenceService from "@/services/recurrenceService";

export type { Task, ScheduleHistoryEntry } from "@/types/daily";
export type { TaskInsert, TaskUpdate } from "@/services/taskService";

// ── Hook: useTasks ──

interface UseTasksOptions {
  date?: Date;
  goalId?: string;
  status?: Task["status"];
  includeOverdue?: boolean;
  onOpenTask?: (id: string) => void;
  /**
   * Skip the list query entirely — for consumers that mount everywhere but only
   * use the mutations (e.g. the always-mounted quick-add modal). Without this,
   * an unfiltered `useTasks()` pulls the whole tasks table on every page.
   */
  skipList?: boolean;
}

export function useTasks(opts: UseTasksOptions = {}) {
  const queryClient = useQueryClient();
  const dateStr = opts.date ? format(opts.date, "yyyy-MM-dd") : undefined;

  const queryKey = ["tasks", dateStr, opts.goalId, opts.status, opts.includeOverdue];

  const { data: tasks, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      taskService.fetchTasks(supabase, {
        date: dateStr,
        goalId: opts.goalId,
        status: opts.status,
        includeOverdue: opts.includeOverdue,
      }),
    enabled: !opts.skipList,
  });

  // Count recurring task completions for the selected date (these don't show
  // up as status="done" tasks because the task is immediately rescheduled)
  const { data: recurringCompletionCount } = useQuery({
    queryKey: ["recurrence_completions", dateStr],
    queryFn: async () => {
      if (!dateStr) return 0;
      const { count, error } = await supabase
        .from("recurrence_completions")
        .select("*", { count: "exact", head: true })
        .eq("scheduled_for", dateStr);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!dateStr,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["recurrence_completions"] });
  };

  const cachedTask = (id: string) => findInCache<Task>(queryClient, ["tasks"], id);

  // ── Optimistic cache helpers ──
  //
  // Mutations invalidate every ["tasks"] query, so the UI would otherwise sit
  // on stale rows until a full round trip + refetch completes — very visible on
  // the Today list, where ticking a checkbox is the hottest interaction. These
  // patch the cached lists up front and hand back a snapshot for rollback.

  type TasksSnapshot = [QueryKey, Task[] | undefined][];

  const patchTaskInCache = (id: string, patch: Partial<Task>): TasksSnapshot => {
    const previous = queryClient.getQueriesData<Task[]>({ queryKey: ["tasks"] });
    queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (list) =>
      list?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
    return previous;
  };

  const removeTaskFromCache = (id: string): TasksSnapshot => {
    const previous = queryClient.getQueriesData<Task[]>({ queryKey: ["tasks"] });
    queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (list) =>
      list?.filter((t) => t.id !== id),
    );
    return previous;
  };

  const restoreTasksCache = (previous: TasksSnapshot | undefined) => {
    previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
  };

  const openTaskLink = (id: string) =>
    opts.onOpenTask ? () => opts.onOpenTask!(id) : undefined;

  const createTask = useMutation({
    mutationFn: (input: taskService.TaskInsert) => taskService.createTask(supabase, input),
    onSuccess: (created: Task) => {
      invalidate();
      const display = `"${truncate(created.title)}"`;
      undoToast({
        title: toastTitle(display, "added", openTaskLink(created.id)),
        onUndo: () => {
          supabase.from("tasks").delete().eq("id", created.id).then(() => invalidate());
        },
      });
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: taskService.TaskUpdate }) =>
      taskService.updateTask(supabase, id, updates),
    onMutate: ({ id, updates }) => ({
      previous: patchTaskInCache(id, updates as Partial<Task>),
    }),
    onError: (_error, _vars, context) => restoreTasksCache(context?.previous),
    onSuccess: invalidate,
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => taskService.deleteTask(supabase, id),
    onMutate: (id: string) => ({ task: cachedTask(id), previous: removeTaskFromCache(id) }),
    onError: (_error, _id, context) => restoreTasksCache(context?.previous),
    onSuccess: (_, __, context) => {
      invalidate();
      const task = context?.task;
      if (!task) return;
      if (task.recurrence_rule) {
        // Recurring tasks cascade-delete completion history — undo can't restore it
        toast({ title: `"${truncate(task.title)}" deleted` });
      } else {
        undoToast({
          title: `"${truncate(task.title)}" deleted`,
          onUndo: () => {
            supabase.from("tasks").insert(taskService.taskToInsertRow(task)).then(() => invalidate());
          },
        });
      }
    },
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const task = cachedTask(id);
      if (task?.recurrence_rule) {
        return recurrenceService.completeRecurring(supabase, {
          id: task.id,
          recurrence_rule: task.recurrence_rule,
          scheduled_date: task.scheduled_date,
        });
      }
      await taskService.completeTask(supabase, id);
      return undefined;
    },
    onMutate: (id: string) => {
      const task = cachedTask(id);
      // Recurring completion reschedules the task to a date the server picks,
      // so there is nothing safe to predict — let the refetch settle those.
      const previous = task?.recurrence_rule
        ? undefined
        : patchTaskInCache(id, { status: "done", completed_at: new Date().toISOString() });
      return { task, previous };
    },
    onError: (_error, _id, context) => restoreTasksCache(context?.previous),
    onSuccess: (nextDate: string | undefined, id, context) => {
      invalidate();
      const task = context?.task;
      const display = `"${truncate(task?.title ?? "Task")}"`;

      if (nextDate) {
        undoToast({
          title: `${display} completed`,
          description: `Next: ${format(new Date(nextDate + "T00:00:00"), "MMM d, yyyy")}`,
          onUndo: async () => {
            // Delete the completion log entry that was just created
            await supabase
              .from("recurrence_completions")
              .delete()
              .eq("task_id", id)
              .eq("scheduled_for", task?.scheduled_date ?? format(new Date(), "yyyy-MM-dd"));
            // Shift the date back to the original
            await supabase
              .from("tasks")
              .update({
                scheduled_date: task?.scheduled_date,
                updated_at: new Date().toISOString(),
              })
              .eq("id", id);
            invalidate();
          },
        });
      } else {
        undoToast({
          title: `${display} completed`,
          onUndo: () => {
            supabase
              .from("tasks")
              .update({ status: "open", completed_at: null, updated_at: new Date().toISOString() })
              .eq("id", id)
              .then(() => invalidate());
          },
        });
      }
    },
  });

  const rescheduleTask = useMutation({
    mutationFn: ({ id, toDate }: { id: string; toDate: string | null }) =>
      taskService.rescheduleTask(supabase, id, toDate),
    onSuccess: invalidate,
  });

  const discardTask = useMutation({
    mutationFn: (id: string) => taskService.discardTask(supabase, id),
    onMutate: (id: string) => ({
      title: cachedTask(id)?.title ?? "Task",
      previous: removeTaskFromCache(id),
    }),
    onError: (_error, _id, context) => restoreTasksCache(context?.previous),
    onSuccess: (_, id, context) => {
      invalidate();
      const display = `"${truncate(context?.title ?? "Task")}"`;
      undoToast({
        title: toastTitle(display, "discarded", openTaskLink(id)),
        onUndo: () => {
          supabase
            .from("tasks")
            .update({ status: "open", discarded_at: null, updated_at: new Date().toISOString() })
            .eq("id", id)
            .then(() => invalidate());
        },
      });
    },
  });

  const batchUpdateTasks = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: taskService.TaskUpdate }) =>
      taskService.batchUpdateTasks(supabase, ids, updates),
    onSuccess: invalidate,
  });

  const batchDeleteTasks = useMutation({
    mutationFn: (ids: string[]) => taskService.batchDeleteTasks(supabase, ids),
    onSuccess: invalidate,
  });

  const logTime = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      taskService.logTime(supabase, id, minutes),
    onSuccess: invalidate,
  });

  return {
    tasks: tasks ?? [],
    isLoading,
    recurringCompletionCount: recurringCompletionCount ?? 0,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    rescheduleTask,
    discardTask,
    logTime,
    batchUpdateTasks,
    batchDeleteTasks,
  };
}

