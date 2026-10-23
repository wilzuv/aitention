import { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ── Types ──

export type Project = Tables<"projects">;
export type ProjectInsert = TablesInsert<"projects">;
export type ProjectUpdate = TablesUpdate<"projects">;
export type ProjectStatus = "active" | "archived";

export interface CreateProjectInput {
  name?: string | null;
  description?: string | null;
}

export interface UpdateProjectInput {
  name?: string | null;
  description?: string | null;
  status?: ProjectStatus;
}

// ── Milestones ──
// Ordered checkpoints inside a project (Linear's model). A milestone belongs to
// exactly one project; items are filed under it via their milestone_id column.

export type Milestone = Tables<"project_milestones">;
export type MilestoneInsert = TablesInsert<"project_milestones">;
export type MilestoneUpdate = TablesUpdate<"project_milestones">;

export interface CreateMilestoneInput {
  projectId: string;
  name: string;
  description?: string | null;
  targetDate?: string | null; // ISO date (YYYY-MM-DD) or null
}

export interface UpdateMilestoneInput {
  name?: string;
  description?: string | null;
  targetDate?: string | null;
  sortOrder?: number;
}

// Derived completion of a milestone: how many of its assigned items (across all
// primitive types) have reached a terminal state. Never stored — always
// recomputed from the current items.
export interface MilestoneProgress {
  total: number;
  done: number;
}

// The primitives that can belong to a project. Each maps to a table; the
// project_id column on that table is the single source of membership.
export type ProjectItemType =
  | "task"
  | "goal"
  | "hypothesis"
  | "decision"
  | "experiment"
  | "prediction";

export const PROJECT_ITEM_TYPES: ProjectItemType[] = [
  "task",
  "goal",
  "hypothesis",
  "decision",
  "experiment",
  "prediction",
];

const ITEM_TABLE: Record<ProjectItemType, string> = {
  task: "tasks",
  goal: "goals",
  hypothesis: "hypotheses",
  decision: "decisions",
  experiment: "experiments",
  prediction: "predictions",
};

// Plain-English plurals for section headings.
export const ITEM_TYPE_LABELS: Record<ProjectItemType, string> = {
  task: "Tasks",
  goal: "Goals",
  hypothesis: "Hypotheses",
  decision: "Decisions",
  experiment: "Experiments",
  prediction: "Predictions",
};

// A normalized, display-ready item belonging to (or assignable to) a project.
// Each primitive has its own label/status column; we flatten them here so the
// project view can render every type with one component.
export interface ProjectItem {
  id: string;
  type: ProjectItemType;
  title: string;
  status: string | null;
  // Whether the item is still active/open (vs. a terminal state like a done
  // task, closed goal, or archived hypothesis). Drives the "show open only"
  // filter in the project view. Derived per-type below since each primitive
  // encodes "done" differently.
  open: boolean;
  // Which milestone the item is filed under within the project, or null. Used
  // to group items and derive per-milestone progress.
  milestoneId: string | null;
}

// Per-type query config: which columns to pull and how to derive a label +
// status from a row. Keeping this in one place means adding a future primitive
// is a single entry, not a new code path.
interface ItemMapper {
  columns: string;
  toItem: (row: Record<string, unknown>) => Omit<ProjectItem, "type">;
}

// Every mapper also pulls milestone_id — the item's assignment within its
// project — so the project view can group items and derive per-milestone
// progress without a second round of queries.
const ITEM_MAPPERS: Record<ProjectItemType, ItemMapper> = {
  task: {
    columns: "id, title, status, milestone_id",
    // open = the only non-terminal task status; done/discarded are terminal.
    toItem: (r) => ({
      id: r.id as string,
      title: r.title as string,
      status: r.status as string | null,
      open: r.status === "open",
      milestoneId: (r.milestone_id as string | null) ?? null,
    }),
  },
  goal: {
    // status NULL = open; done/failed/dropped are terminal.
    columns: "id, title, status, milestone_id",
    toItem: (r) => ({
      id: r.id as string,
      title: r.title as string,
      status: (r.status as string | null) ?? "open",
      open: !["done", "failed", "dropped"].includes(r.status as string),
      milestoneId: (r.milestone_id as string | null) ?? null,
    }),
  },
  hypothesis: {
    columns: "id, statement, current_credence, archived_at, milestone_id",
    toItem: (r) => ({
      id: r.id as string,
      title: r.statement as string,
      status: r.archived_at ? "archived" : `${r.current_credence as number}%`,
      open: !r.archived_at,
      milestoneId: (r.milestone_id as string | null) ?? null,
    }),
  },
  decision: {
    columns: "id, title, status, milestone_id",
    // decided/abandoned are terminal; everything else (open) is active.
    toItem: (r) => ({
      id: r.id as string,
      title: r.title as string,
      status: r.status as string | null,
      open: !["decided", "abandoned"].includes(r.status as string),
      milestoneId: (r.milestone_id as string | null) ?? null,
    }),
  },
  experiment: {
    columns: "id, title, status, milestone_id",
    // running is the only active state; concluded/abandoned are terminal.
    toItem: (r) => ({
      id: r.id as string,
      title: r.title as string,
      status: r.status as string | null,
      open: r.status === "running",
      milestoneId: (r.milestone_id as string | null) ?? null,
    }),
  },
  prediction: {
    columns: "id, prediction, outcome, milestone_id",
    // outcome NULL = still open; any resolved outcome is terminal.
    toItem: (r) => ({
      id: r.id as string,
      title: r.prediction as string,
      status: (r.outcome as string | null) ?? "open",
      open: r.outcome == null,
      milestoneId: (r.milestone_id as string | null) ?? null,
    }),
  },
};

// ── Reads ──

export async function fetchProjects(
  supabase: SupabaseClient,
  opts: { status?: ProjectStatus } = {}
): Promise<Project[]> {
  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function fetchProject(
  supabase: SupabaseClient,
  id: string
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Project | null;
}

// All items filed under a project, grouped by type. Runs the six reads in
// parallel; each is RLS-scoped to the caller's own rows.
export async function fetchProjectItems(
  supabase: SupabaseClient,
  projectId: string
): Promise<Record<ProjectItemType, ProjectItem[]>> {
  const entries = await Promise.all(
    PROJECT_ITEM_TYPES.map(async (type) => {
      const mapper = ITEM_MAPPERS[type];
      const { data, error } = await supabase
        .from(ITEM_TABLE[type])
        .select(mapper.columns)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const items = (data ?? []).map(
        (row) => ({ ...mapper.toItem(row as unknown as Record<string, unknown>), type })
      );
      return [type, items] as const;
    })
  );
  return Object.fromEntries(entries) as Record<ProjectItemType, ProjectItem[]>;
}

// Items of one type not yet assigned to any project — the candidate pool for
// the "Add to project" picker in the project view.
export async function fetchUnassignedItems(
  supabase: SupabaseClient,
  type: ProjectItemType
): Promise<ProjectItem[]> {
  const mapper = ITEM_MAPPERS[type];
  const { data, error } = await supabase
    .from(ITEM_TABLE[type])
    .select(mapper.columns)
    .is("project_id", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(
    (row) => ({ ...mapper.toItem(row as unknown as Record<string, unknown>), type })
  );
}

// ── Writes ──

export async function createProject(
  supabase: SupabaseClient,
  input: CreateProjectInput
): Promise<Project> {
  const payload: ProjectInsert = {
    name: input.name ?? null,
    description: input.description ?? null,
  };
  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  supabase: SupabaseClient,
  id: string,
  updates: UpdateProjectInput
): Promise<void> {
  const patch: ProjectUpdate = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.status !== undefined) patch.status = updates.status;

  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) throw error;
}

// Deleting a project orphans its items (project_id SET NULL by the FK), so the
// work filed under it is preserved.
export async function deleteProject(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

// Attach (projectId set) or detach (projectId null) a single item. Generic over
// the primitive type — membership is just the project_id column on each table.
// Any project change also clears milestone_id: a milestone belongs to one
// project, so an item can't keep a milestone from a project it just left.
export async function setItemProject(
  supabase: SupabaseClient,
  type: ProjectItemType,
  id: string,
  projectId: string | null
): Promise<void> {
  const { error } = await supabase
    .from(ITEM_TABLE[type])
    .update({
      project_id: projectId,
      milestone_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

// Local YYYY-MM-DD for date-typed columns that are NOT NULL (task
// scheduled_date, experiment start_date, prediction resolution_date). A
// quick-created item just needs a valid placeholder the user can refine later.
function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}

// Create a new primitive already linked to a project (and optionally a
// milestone), directly from the project view. Each type is born with the
// minimum its schema requires plus sensible defaults; the user opens the item
// to fill in the rest. Returns the new row's id. This is the "create" companion
// to setItemProject's "attach an existing item".
export async function createProjectItem(
  supabase: SupabaseClient,
  type: ProjectItemType,
  title: string,
  projectId: string,
  milestoneId: string | null = null
): Promise<string> {
  const link = { project_id: projectId, milestone_id: milestoneId };
  const payload: Record<ProjectItemType, Record<string, unknown>> = {
    task: { title, status: "open", scheduled_date: todayIso(), ...link },
    goal: { title, ...link },
    hypothesis: { statement: title, current_credence: 50, ...link },
    decision: { title, context: "", ...link },
    experiment: { title, protocol: "", start_date: todayIso(), ...link },
    prediction: {
      prediction: title,
      confidence: 50,
      resolution_date: todayIso(),
      source: "user",
      ...link,
    },
  };
  const { data, error } = await supabase
    .from(ITEM_TABLE[type])
    .insert(payload[type])
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// ── Milestone reads/writes ──

export async function fetchMilestones(
  supabase: SupabaseClient,
  projectId: string
): Promise<Milestone[]> {
  const { data, error } = await supabase
    .from("project_milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Milestone[];
}

export async function createMilestone(
  supabase: SupabaseClient,
  input: CreateMilestoneInput
): Promise<Milestone> {
  // New milestones append to the end of the project's sequence.
  const { data: last, error: readErr } = await supabase
    .from("project_milestones")
    .select("sort_order")
    .eq("project_id", input.projectId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (readErr) throw readErr;
  const nextOrder =
    last && last.length > 0 ? (last[0].sort_order as number) + 1 : 0;

  const payload: MilestoneInsert = {
    project_id: input.projectId,
    name: input.name,
    description: input.description ?? null,
    target_date: input.targetDate ?? null,
    sort_order: nextOrder,
  };
  const { data, error } = await supabase
    .from("project_milestones")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as Milestone;
}

export async function updateMilestone(
  supabase: SupabaseClient,
  id: string,
  updates: UpdateMilestoneInput
): Promise<void> {
  const patch: MilestoneUpdate = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.targetDate !== undefined) patch.target_date = updates.targetDate;
  if (updates.sortOrder !== undefined) patch.sort_order = updates.sortOrder;

  const { error } = await supabase
    .from("project_milestones")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

// Deleting a milestone unfiles its items (milestone_id SET NULL by the FK); the
// items themselves stay in the project.
export async function deleteMilestone(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Persist a manual reorder: sort_order becomes each milestone's position in the
// given list. Runs the writes in parallel and surfaces the first failure.
export async function reorderMilestones(
  supabase: SupabaseClient,
  orderedIds: string[]
): Promise<void> {
  const now = new Date().toISOString();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("project_milestones")
        .update({ sort_order: index, updated_at: now })
        .eq("id", id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

// File an item under a milestone (or clear it with null). Generic over type —
// membership is just the milestone_id column. The caller is responsible for
// only assigning milestones that belong to the item's own project.
export async function setItemMilestone(
  supabase: SupabaseClient,
  type: ProjectItemType,
  id: string,
  milestoneId: string | null
): Promise<void> {
  const { error } = await supabase
    .from(ITEM_TABLE[type])
    .update({ milestone_id: milestoneId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Derive per-milestone progress from a project's grouped items. Counts every
// assigned item across all types; done = items in a terminal state.
export function computeMilestoneProgress(
  itemsByType: Record<ProjectItemType, ProjectItem[]>
): Record<string, MilestoneProgress> {
  const progress: Record<string, MilestoneProgress> = {};
  for (const type of PROJECT_ITEM_TYPES) {
    for (const item of itemsByType[type] ?? []) {
      if (!item.milestoneId) continue;
      const entry = (progress[item.milestoneId] ??= { total: 0, done: 0 });
      entry.total += 1;
      if (!item.open) entry.done += 1;
    }
  }
  return progress;
}
