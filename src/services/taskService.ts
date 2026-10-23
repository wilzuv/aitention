import { SupabaseClient } from "@supabase/supabase-js";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { Task, ScheduleHistoryEntry } from "@/types/daily";
import type { RecurrenceRule } from "@/lib/recurrence";

// ── Re-export types used by hooks ──

export type TaskRow = Tables<"tasks">;
export type TaskInsertRow = TablesInsert<"tasks">;
export type TaskUpdateRow = TablesUpdate<"tasks">;

export type TaskInsert = Partial<Omit<Task, "id" | "created_at" | "updated_at">> & {
  title: string;
  scheduled_date: string;
};

export type TaskUpdate = Partial<Omit<Task, "id" | "created_at" | "updated_at">>;

// An append-only activity log entry attached to a task. The running-thinking
// layer next to a task's static notes/reflection — mirrors decision_notes /
// experiment_logs / goal_logs.
export interface TaskLog {
  id: string;
  user_id: string;
  task_id: string;
  note: string;
  logged_at: string;
}

// ── Parsing ──

export function parseTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status as Task["status"],
    due_date: row.due_date,
    scheduled_date: row.scheduled_date,
    goal_id: row.goal_id,
    estimated_minutes: row.estimated_minutes,
    actual_minutes: (row.actual_minutes as number | null) ?? 0,
    success_criteria: row.success_criteria,
    notes: row.notes,
    reflection: row.reflection,
    recurrence_rule: (row.recurrence_rule as unknown as RecurrenceRule | null) ?? null,
    schedule_history: ((row as Record<string, unknown>).schedule_history as ScheduleHistoryEntry[] | null) ?? [],
    reschedule_count: (((row as Record<string, unknown>).schedule_history as ScheduleHistoryEntry[] | null) ?? []).length,
    completed_at: row.completed_at,
    discarded_at: row.discarded_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    linear_ticket_id: ((row as Record<string, unknown>).linear_ticket_id as string | null) ?? null,
    project_id: (row.project_id as string | null) ?? null,
    milestone_id: (row.milestone_id as string | null) ?? null,
  };
}

/** Build a TaskInsertRow from a Task (for undo-delete re-insertion) */
export function taskToInsertRow(t: Task): TaskInsertRow {
  const row: TaskInsertRow = {
    title: t.title,
    status: t.status,
    due_date: t.due_date,
    scheduled_date: t.scheduled_date,
    goal_id: t.goal_id,
    estimated_minutes: t.estimated_minutes,
    success_criteria: t.success_criteria,
    notes: t.notes,
    reflection: t.reflection,
    recurrence_rule: (t.recurrence_rule ?? null) as unknown as Json,
    project_id: t.project_id ?? null,
    milestone_id: t.milestone_id ?? null,
  };
  (row as Record<string, unknown>).linear_ticket_id = t.linear_ticket_id ?? null;
  return row;
}

// ── Payload building ──

export function buildInsertPayload(input: TaskInsert): TaskInsertRow {
  const payload: TaskInsertRow = {
    title: input.title,
    status: input.status ?? "open",
    due_date: input.due_date ?? null,
    scheduled_date: input.scheduled_date,
    goal_id: input.goal_id ?? null,
    estimated_minutes: input.estimated_minutes ?? null,
    success_criteria: input.success_criteria ?? null,
    notes: input.notes ?? null,
    recurrence_rule: (input.recurrence_rule ?? null) as unknown as Json,
    project_id: input.project_id ?? null,
    milestone_id: input.milestone_id ?? null,
  };
  if ("linear_ticket_id" in input) {
    (payload as Record<string, unknown>).linear_ticket_id = input.linear_ticket_id ?? null;
  }
  return payload;
}

export function buildUpdatePayload(updates: TaskUpdate): TaskUpdateRow {
  const now = new Date().toISOString();
  const payload: TaskUpdateRow = { updated_at: now };

  if ("title" in updates) payload.title = updates.title;
  if ("status" in updates) payload.status = updates.status;
  if ("due_date" in updates) payload.due_date = updates.due_date;
  if ("scheduled_date" in updates) payload.scheduled_date = updates.scheduled_date;
  if ("goal_id" in updates) payload.goal_id = updates.goal_id;
  if ("estimated_minutes" in updates) payload.estimated_minutes = updates.estimated_minutes;
  if ("actual_minutes" in updates) payload.actual_minutes = updates.actual_minutes;
  if ("success_criteria" in updates) payload.success_criteria = updates.success_criteria;
  if ("notes" in updates) payload.notes = updates.notes;
  if ("reflection" in updates) payload.reflection = updates.reflection;
  if ("recurrence_rule" in updates) payload.recurrence_rule = (updates.recurrence_rule ?? null) as unknown as Json;
  if ("schedule_history" in updates) (payload as Record<string, unknown>).schedule_history = (updates.schedule_history ?? []) as unknown as Json;
  if ("linear_ticket_id" in updates) (payload as Record<string, unknown>).linear_ticket_id = updates.linear_ticket_id ?? null;
  if ("project_id" in updates) payload.project_id = updates.project_id;
  if ("milestone_id" in updates) payload.milestone_id = updates.milestone_id;
  if ("completed_at" in updates) payload.completed_at = updates.completed_at;
  if ("discarded_at" in updates) payload.discarded_at = updates.discarded_at;

  // Auto-set timestamps
  if (updates.status === "done" && !updates.completed_at) {
    payload.completed_at = now;
  }
  if (updates.status === "discarded" && !updates.discarded_at) {
    payload.discarded_at = now;
  }

  return payload;
}

// ── Read operations ──

export interface FetchTasksOptions {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  goalId?: string;
  status?: Task["status"];
  includeOverdue?: boolean;
}

export async function fetchTasks(
  supabase: SupabaseClient,
  opts: FetchTasksOptions = {}
): Promise<Task[]> {
  let query = supabase.from("tasks").select("*");

  if (opts.dateFrom && opts.dateTo) {
    // Range query: tasks whose scheduled_date or due_date falls within [dateFrom, dateTo]
    query = query.or(
      `and(scheduled_date.gte.${opts.dateFrom},scheduled_date.lte.${opts.dateTo}),` +
      `and(due_date.gte.${opts.dateFrom},due_date.lte.${opts.dateTo})`
    );
  } else if (opts.date) {
    if (opts.includeOverdue) {
      query = query.or(
        `scheduled_date.eq.${opts.date},due_date.eq.${opts.date},` +
        `and(status.eq.open,scheduled_date.lt.${opts.date}),` +
        `and(status.eq.open,due_date.lt.${opts.date})`
      );
    } else {
      query = query.or(`scheduled_date.eq.${opts.date},due_date.eq.${opts.date}`);
    }
  }
  if (opts.goalId) {
    query = query.eq("goal_id", opts.goalId);
  }
  if (opts.status) {
    query = query.eq("status", opts.status);
  }
  query = query.order("created_at", { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(parseTask);
}

export async function fetchLogsForTask(
  supabase: SupabaseClient,
  taskId: string
): Promise<TaskLog[]> {
  const { data, error } = await supabase
    .from("task_logs")
    .select("*")
    .eq("task_id", taskId)
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskLog[];
}

// ── Write operations ──

export async function insertTaskLog(
  supabase: SupabaseClient,
  input: {
    task_id: string;
    note: string;
    logged_at?: string;
  }
): Promise<TaskLog> {
  const { data, error } = await supabase
    .from("task_logs")
    .insert({
      task_id: input.task_id,
      note: input.note,
      logged_at: input.logged_at ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskLog;
}

export async function createTask(supabase: SupabaseClient, input: TaskInsert): Promise<Task> {
  const payload = buildInsertPayload(input);
  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error("Task was created but no data was returned");
  return parseTask(data);
}

export async function updateTask(supabase: SupabaseClient, id: string, updates: TaskUpdate): Promise<void> {
  const payload = buildUpdatePayload(updates);
  const { error } = await supabase.from("tasks").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function completeTask(supabase: SupabaseClient, id: string): Promise<void> {
  const now = new Date().toISOString();
  const patch: TaskUpdateRow = { status: "done", completed_at: now, updated_at: now };
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function rescheduleTask(
  supabase: SupabaseClient,
  id: string,
  toDate: string
): Promise<void> {
  const now = new Date().toISOString();

  const { data: current } = await supabase
    .from("tasks")
    .select("scheduled_date, schedule_history")
    .eq("id", id)
    .single();
  if (!current) throw new Error("Task not found");

  const currentHistory = ((current as Record<string, unknown>).schedule_history as ScheduleHistoryEntry[] | null) ?? [];
  const historyEntry: ScheduleHistoryEntry = {
    from: current.scheduled_date,
    to: toDate,
    changed_at: now,
  };

  // Decision #19: Cap to one reschedule entry per day — keep the latest.
  // This filters out noise from misclicks while preserving the signal of
  // a task being postponed across different days.
  const todayDate = now.slice(0, 10);
  const filteredHistory = currentHistory.filter(
    (entry) => entry.changed_at.slice(0, 10) !== todayDate
  );

  const patch: Record<string, unknown> = {
    scheduled_date: toDate,
    schedule_history: [...filteredHistory, historyEntry] as unknown as Json,
    updated_at: now,
  };

  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function discardTask(supabase: SupabaseClient, id: string): Promise<void> {
  const now = new Date().toISOString();
  const patch: TaskUpdateRow = { status: "discarded", discarded_at: now, updated_at: now };
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function logTime(supabase: SupabaseClient, id: string, minutes: number): Promise<void> {
  // Atomic increment via rpc to avoid read-then-write race condition
  const { error } = await supabase.rpc("increment_actual_minutes", {
    task_id: id,
    add_minutes: minutes,
  });
  if (error) throw error;
}

export async function batchUpdateTasks(
  supabase: SupabaseClient,
  ids: string[],
  updates: TaskUpdate
): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  const payload: TaskUpdateRow = { updated_at: now };

  if ("title" in updates) payload.title = updates.title;
  if ("status" in updates) payload.status = updates.status;
  if ("due_date" in updates) payload.due_date = updates.due_date;
  if ("scheduled_date" in updates) payload.scheduled_date = updates.scheduled_date;
  if ("goal_id" in updates) payload.goal_id = updates.goal_id;

  if (updates.status === "done") payload.completed_at = now;
  if (updates.status === "discarded") payload.discarded_at = now;

  const { error } = await supabase.from("tasks").update(payload).in("id", ids);
  if (error) throw error;
}

export async function batchDeleteTasks(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("tasks").delete().in("id", ids);
  if (error) throw error;
}
