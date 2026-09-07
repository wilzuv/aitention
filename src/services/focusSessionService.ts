// src/services/focusSessionService.ts
import { SupabaseClient } from "@supabase/supabase-js";
import type { FocusSession, SessionTask } from "@/types/daily";

// ── Parsing ──

function parseSessionTask(row: Record<string, unknown>): SessionTask {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    session_id: row.session_id as string,
    task_id: row.task_id as string,
    is_primary: row.is_primary as boolean,
    linked_when: row.linked_when as "before" | "after",
  };
}

function parseFocusSession(row: Record<string, unknown>): FocusSession {
  const sessionTasks = row.session_tasks;
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    entry_date: row.entry_date as string,
    started_at: row.started_at as string,
    ended_at: row.ended_at as string | null,
    duration_minutes: row.duration_minutes as number | null,
    pre_session_notes: row.pre_session_notes as string | null,
    post_session_notes: row.post_session_notes as string | null,
    enjoyment_rating: row.enjoyment_rating as number | null,
    created_at: row.created_at as string,
    session_tasks: Array.isArray(sessionTasks)
      ? sessionTasks.map((st: Record<string, unknown>) => ({
          ...parseSessionTask(st),
          task: st.tasks as FocusSession["session_tasks"] extends (infer T)[] ? T extends { task?: infer U } ? U : never : never,
        }))
      : undefined,
  };
}

// ── Read ──

export async function fetchSessions(
  supabase: SupabaseClient,
  date: string
): Promise<FocusSession[]> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select(`
      *,
      session_tasks (
        *,
        tasks (id, title, status, priority, scheduled_date)
      )
    `)
    .eq("entry_date", date)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => parseFocusSession(row as unknown as Record<string, unknown>));
}

export async function fetchSessionsRange(
  supabase: SupabaseClient,
  dateFrom: string,
  dateTo: string
): Promise<FocusSession[]> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select(`
      *,
      session_tasks (
        *,
        tasks (id, title, status, priority, scheduled_date)
      )
    `)
    .gte("entry_date", dateFrom)
    .lte("entry_date", dateTo)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => parseFocusSession(row as unknown as Record<string, unknown>));
}

/** Fetch the single unclosed session (ended_at IS NULL), if any. */
export async function fetchUnclosedSession(
  supabase: SupabaseClient,
): Promise<FocusSession | null> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select(`
      *,
      session_tasks (
        *,
        tasks (id, title, status, priority, scheduled_date)
      )
    `)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? parseFocusSession(data as unknown as Record<string, unknown>) : null;
}

// ── Write ──

export async function createSession(
  supabase: SupabaseClient,
  date: string,
  input: {
    taskIds: string[];
    preSessionNotes?: string;
    startedAt?: string;
    entryDate?: string;
    skipActiveCheck?: boolean;
  }
): Promise<FocusSession> {
  // Guard: no concurrent sessions. The UI handles recovery of unclosed sessions
  // before reaching this point, so any remaining active session is a real conflict.
  // Skipped for manual past-session logging (completed immediately after creation).
  if (!input.skipActiveCheck) {
    const { data: activeSessions } = await supabase
      .from("focus_sessions")
      .select("id")
      .is("ended_at", null)
      .limit(1);

    if (activeSessions && activeSessions.length > 0) {
      throw new Error(
        "A focus session is already in progress. End it before starting a new one.",
      );
    }
  }

  const now = new Date().toISOString();
  const { data: session, error: sessionError } = await supabase
    .from("focus_sessions")
    .insert({
      entry_date: input.entryDate ?? date,
      started_at: input.startedAt ?? now,
      pre_session_notes: input.preSessionNotes ?? null,
    })
    .select()
    .single();
  if (sessionError) throw sessionError;
  if (!session) throw new Error("No session returned");

  // Link tasks
  const sessionTaskRows = input.taskIds.map((taskId, i) => ({
    session_id: session.id,
    task_id: taskId,
    is_primary: i === 0,
    linked_when: "before" as const,
  }));

  if (sessionTaskRows.length > 0) {
    const { error: linkError } = await supabase
      .from("session_tasks")
      .insert(sessionTaskRows);
    if (linkError) throw linkError;
  }

  // Re-fetch with the join so session_tasks are included
  const { data: fullSession, error: refetchError } = await supabase
    .from("focus_sessions")
    .select(`
      *,
      session_tasks (
        *,
        tasks (id, title, status, priority, scheduled_date)
      )
    `)
    .eq("id", session.id)
    .single();
  if (refetchError) throw refetchError;
  return parseFocusSession(fullSession as unknown as Record<string, unknown>);
}

export async function completeSession(
  supabase: SupabaseClient,
  input: {
    id: string;
    durationMinutes: number;
    postSessionNotes?: string;
    enjoymentRating?: number;
  }
): Promise<FocusSession> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .update({
      duration_minutes: input.durationMinutes,
      ended_at: new Date().toISOString(),
      post_session_notes: input.postSessionNotes ?? null,
      enjoyment_rating: input.enjoymentRating ?? null,
    })
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return parseFocusSession(data as unknown as Record<string, unknown>);
}

export async function updateSession(
  supabase: SupabaseClient,
  id: string,
  fields: Partial<{
    duration_minutes: number;
    pre_session_notes: string;
    post_session_notes: string;
    enjoyment_rating: number;
    started_at: string;
  }>
): Promise<FocusSession> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return parseFocusSession(data as unknown as Record<string, unknown>);
}

export async function deleteSession(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from("focus_sessions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function linkTask(
  supabase: SupabaseClient,
  input: {
    sessionId: string;
    taskId: string;
    linkedWhen: "before" | "after";
  }
): Promise<SessionTask> {
  const { data, error } = await supabase
    .from("session_tasks")
    .insert({
      session_id: input.sessionId,
      task_id: input.taskId,
      is_primary: false,
      linked_when: input.linkedWhen,
    })
    .select()
    .single();
  if (error) throw error;
  return parseSessionTask(data as Record<string, unknown>);
}
