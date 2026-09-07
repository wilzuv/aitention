import { SupabaseClient } from "@supabase/supabase-js";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ── Types ──

export type Goal = Tables<"goals">;
export type GoalInsert = TablesInsert<"goals">;
export type GoalUpdate = TablesUpdate<"goals">;
export type GoalStatus = "done" | "failed" | "dropped";

export type GoalLogKind = "note" | "status_change";

// An entry on a goal's activity timeline: either a freeform note or an
// automatic record of a status transition.
export interface GoalLog {
  id: string;
  user_id: string;
  goal_id: string;
  kind: GoalLogKind;
  note: string | null;
  from_status: GoalStatus | null;
  to_status: GoalStatus | null;
  logged_at: string;
}

export interface CreateGoalInput {
  title: string;
  notes?: string;
  parentGoalId?: string;
  reviewDate?: string;
  foundationId?: string | null;
}

export interface FetchGoalsOptions {
  status?: GoalStatus | null;
  open?: boolean;
  parentGoalId?: string | null;
  reviewBefore?: string;
  reviewAfter?: string;
}

// ── Reads ──

export async function fetchGoals(
  supabase: SupabaseClient,
  opts: FetchGoalsOptions = {}
): Promise<Goal[]> {
  let query = supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: true });

  if (opts.open) {
    query = query.is("status", null);
  } else if (opts.status) {
    query = query.eq("status", opts.status);
  }
  if (opts.reviewBefore) query = query.lte("review_date", opts.reviewBefore);
  if (opts.reviewAfter) query = query.gte("review_date", opts.reviewAfter);
  if (opts.parentGoalId !== undefined) {
    if (opts.parentGoalId === null) {
      query = query.is("parent_goal_id", null);
    } else {
      query = query.eq("parent_goal_id", opts.parentGoalId);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function fetchGoal(
  supabase: SupabaseClient,
  id: string
): Promise<Goal | null> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Goal | null;
}

// ── Validation ──

// Prevents circular goal references by walking up the parent chain.
async function assertNoCycle(
  supabase: SupabaseClient,
  goalId: string,
  parentId: string
): Promise<void> {
  if (goalId === parentId) {
    throw new Error("A goal cannot be its own parent.");
  }

  let currentId: string | null = parentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const { data } = await supabase
      .from("goals")
      .select("parent_goal_id")
      .eq("id", currentId)
      .maybeSingle();

    if (!data) break;

    if (data.parent_goal_id === goalId) {
      throw new Error(
        "Setting this parent would create a circular reference."
      );
    }
    currentId = data.parent_goal_id;
  }
}

// ── Writes ──

export async function createGoal(
  supabase: SupabaseClient,
  input: CreateGoalInput
): Promise<Goal> {
  const payload: GoalInsert = {
    title: input.title,
    notes: input.notes ?? null,
    parent_goal_id: input.parentGoalId ?? null,
    review_date: input.reviewDate ?? null,
    foundation_id: input.foundationId ?? null,
  };

  const { data: goal, error } = await supabase
    .from("goals")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  return goal as Goal;
}

export async function updateGoal(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<{
    title: string;
    notes: string | null;
    status: GoalStatus | null;
    parentGoalId: string | null;
    reviewDate: string | null;
    foundationId: string | null;
  }>
): Promise<void> {
  const patch: GoalUpdate = {
    updated_at: new Date().toISOString(),
  };

  // When status is changing, read the prior value first so we can record the
  // transition on the goal's timeline (Linear-style history).
  let prevStatus: GoalStatus | null | undefined;
  if (updates.status !== undefined) {
    const { data: existing } = await supabase
      .from("goals")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    prevStatus = (existing?.status ?? null) as GoalStatus | null;

    patch.status = updates.status;
    if (updates.status !== null) {
      patch.closed_at = new Date().toISOString();
    } else {
      patch.closed_at = null;
    }
  }

  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.foundationId !== undefined) patch.foundation_id = updates.foundationId;
  if (updates.parentGoalId !== undefined) {
    if (updates.parentGoalId !== null) {
      await assertNoCycle(supabase, id, updates.parentGoalId);
    }
    patch.parent_goal_id = updates.parentGoalId;
  }
  if (updates.reviewDate !== undefined) patch.review_date = updates.reviewDate;

  const { error } = await supabase.from("goals").update(patch).eq("id", id);
  if (error) throw error;

  if (updates.status !== undefined && updates.status !== prevStatus) {
    await logGoalStatusChange(supabase, id, prevStatus ?? null, updates.status);
  }
}

// ── Activity timeline ──

export async function fetchLogsForGoal(
  supabase: SupabaseClient,
  goalId: string
): Promise<GoalLog[]> {
  const { data, error } = await supabase
    .from("goal_logs")
    .select("*")
    .eq("goal_id", goalId)
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GoalLog[];
}

export async function insertGoalLog(
  supabase: SupabaseClient,
  input: { goal_id: string; note: string; logged_at?: string }
): Promise<GoalLog> {
  const { data, error } = await supabase
    .from("goal_logs")
    .insert({
      goal_id: input.goal_id,
      kind: "note",
      note: input.note,
      logged_at: input.logged_at ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as GoalLog;
}

// Appends an automatic status_change entry. Called by updateGoal whenever a
// goal's status actually changes; not normally called directly.
export async function logGoalStatusChange(
  supabase: SupabaseClient,
  goalId: string,
  fromStatus: GoalStatus | null,
  toStatus: GoalStatus | null
): Promise<void> {
  const { error } = await supabase.from("goal_logs").insert({
    goal_id: goalId,
    kind: "status_change",
    from_status: fromStatus,
    to_status: toStatus,
  });
  if (error) throw error;
}

export async function deleteGoal(
  supabase: SupabaseClient,
  id: string,
  strategy: "cascade" | "unlink" = "unlink"
): Promise<void> {
  if (strategy === "cascade") {
    const { data: children } = await supabase
      .from("goals")
      .select("id")
      .eq("parent_goal_id", id);

    for (const child of children ?? []) {
      await deleteGoal(supabase, child.id, "cascade");
    }
  } else {
    const { error: unlinkError } = await supabase
      .from("goals")
      .update({ parent_goal_id: null, updated_at: new Date().toISOString() })
      .eq("parent_goal_id", id);
    if (unlinkError) throw unlinkError;
  }

  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
