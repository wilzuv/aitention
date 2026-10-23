// MCP write-tool definitions and handlers.
//
// Behaviour mirrors the in-app agent's write tools (src/services/*). Schemas
// duplicate the canonical descriptors in src/services/agentToolDefinitions.ts
// because Deno can't import the browser-side TS.
//
// Conventions applied uniformly:
//   - Return the affected row so the model can chain on the next turn.
//   - NotFoundError / ValidationError map to JSON-RPC INVALID_PARAMS with a
//     clear message; everything else maps to INTERNAL_ERROR.
//   - Side effects called out in tool descriptions (auto-created data fields,
//     completed_at timestamps, schedule_history append, reflections merge).

import type { ScopedClient } from "./scopedClient.ts";
import {
  NotFoundError,
  ValidationError,
  isoNow,
} from "./helpers.ts";
import {
  getNextRecurringDate,
  getRecurrenceAnchor,
  type RecurrenceRule,
} from "./recurrence.ts";
import { MCP_TOOL_PREFIX, type Params, type ToolDef } from "./toolTypes.ts";

export const WRITE_TOOLS: ToolDef[] = [
  {
    name: `${MCP_TOOL_PREFIX}create_goal`,
    description:
      "Create a new goal. Goals are open by default (status=NULL). Use parent_goal_id to nest goals in a tree. Returns the created goal.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        notes: { type: "string", description: "Resolution criteria — what does done look like?" },
        parent_goal_id: { type: "string", description: "Parent goal id for nesting." },
        review_date: { type: "string", format: "date", description: "When to next review this goal (YYYY-MM-DD)." },
        project_id: { type: "string", description: "Project to file this goal under (see list_projects)." },
      },
      required: ["title"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}update_goal`,
    description:
      "Update fields on an existing goal. Setting status to done/failed/dropped auto-sets closed_at. Setting status to null reopens the goal and clears closed_at. Returns the updated goal.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: {
          type: ["string", "null"],
          enum: ["done", "failed", "dropped", null],
          description: "Set to done/failed/dropped to close, or null to reopen.",
        },
        title: { type: "string" },
        notes: { type: "string", description: "Resolution criteria." },
        review_date: { type: ["string", "null"], format: "date", description: "Next review date (YYYY-MM-DD), or null to clear." },
        parent_goal_id: { type: ["string", "null"], description: "Parent goal id, or null to make it a root goal." },
        project_id: { type: ["string", "null"], description: "Project to file this under, or null to remove from its project." },
      },
      required: ["id"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}delete_goal`,
    description:
      "Delete a goal. strategy='cascade' recursively deletes sub-goals; strategy='unlink' (default) detaches sub-goals by nulling their parent_goal_id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        strategy: { type: "string", enum: ["cascade", "unlink"] },
      },
      required: ["id"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}create_task`,
    description:
      "Create a task. Defaults: status='open'. scheduled_date (required) is when you plan to do it; due_date is an optional hard deadline, independent of scheduled_date. Pass linear_ticket_id (UUID of a linear_tickets row) to link this task to a Linear ticket. Returns the created task.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        goal_id: { type: "string" },
        scheduled_date: { type: "string", format: "date", description: "When you plan to do it (YYYY-MM-DD). Required." },
        due_date: { type: "string", format: "date", description: "Hard deadline (YYYY-MM-DD). Distinct from scheduled_date, which is when you plan to do it." },
        estimated_minutes: { type: "number" },
        notes: { type: "string" },
        linear_ticket_id: { type: "string" },
        project_id: { type: "string", description: "Project to file this task under (see list_projects)." },
      },
      required: ["title", "scheduled_date"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}update_task`,
    description:
      "Update a task — the single write verb for any task change (reschedule = set scheduled_date; complete = status='done'; reopen = status='open'). status='done' auto-sets completed_at; status='discarded' auto-sets discarded_at; status='open' clears both (so an accidental completion or discard undoes cleanly). If status='done' on a task with a recurrence_rule, the task instead stays open with scheduled_date shifted to the next occurrence per its rule, and a row is logged in recurrence_completions (matches the in-app completion path). Pass linear_ticket_id (UUID) to link, or null to clear the link. Returns the updated task.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        status: { type: "string", enum: ["open", "done", "discarded"] },
        scheduled_date: { type: "string", format: "date", description: "Reschedule to this date (YYYY-MM-DD). Cannot be cleared." },
        due_date: { type: ["string", "null"], format: "date", description: "Hard deadline (YYYY-MM-DD), or null to clear." },
        notes: { type: "string" },
        linear_ticket_id: { type: ["string", "null"] },
        project_id: { type: ["string", "null"], description: "Project to file this under, or null to remove from its project." },
      },
      required: ["id"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}delete`,
    description:
      "HARD delete a single record by id. Use this ONLY for accidents — a record created in error (wrong entity, duplicate, test row, mistaken create). It removes the row outright and is irreversible, leaving no trace.\n\n" +
      "Do NOT use delete to wind down a record that was real. Most primitives have their own lifecycle state for that, and those states are tracked, surviving signal — deleting throws that signal away:\n" +
      "  - A task you've decided not to do → update_task(status='discarded'), not delete. Which tasks get dropped (and how often) is useful data about what the user reliably abandons; a hard delete erases it.\n" +
      "  - An experiment that's ending → update_experiment(status=concluded/abandoned + conclusion).\n" +
      "  - A decision reaching its end → decide / review_decision. A hypothesis → update_hypothesis(archived=true).\n" +
      "Reach for delete only when there's no meaningful history to preserve because the record shouldn't have existed in the first place.\n\n" +
      "Supported entities and cascade behaviour (linkages were built delete-safe):\n" +
      "  - `decision` — also removes its notes; linked hypotheses are kept but unlinked (decision_id set null).\n" +
      "  - `hypothesis` — also removes its evidence; linked experiments are kept but unlinked.\n" +
      "  - `experiment` — also removes its daily logs.\n" +
      "  - `prediction` — removed outright (resolved predictions can still be deleted; only edits are blocked).\n" +
      "  - `task` — removed outright; completions and session links cascade, nullable references are cleared.\n" +
      "  - `journal_entry` — removed outright.\n\n" +
      "Goals are deleted separately via delete_goal (it needs a sub-goal cascade/unlink strategy). Returns { deleted: true, entity, id }.",
    inputSchema: {
      type: "object",
      properties: {
        entity: {
          type: "string",
          enum: ["decision", "hypothesis", "experiment", "prediction", "task", "journal_entry"],
          description: "The kind of record to delete.",
        },
        id: { type: "string", description: "UUID of the record to delete." },
      },
      required: ["entity", "id"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}create_prediction`,
    description:
      "Insert a new prediction into the `predictions` table — a free-text falsifiable claim with a confidence. Returns the row.\n\n" +
      "source values: `user` | `agent`. confidence is 0-100. resolution_date is the calendar date the prediction should be resolved on. Optionally file it under a project (project_id) and/or link it to the hypothesis it bears on (hypothesis_id). Make as many predictions per day as you have genuine signal for.",
    inputSchema: {
      type: "object",
      properties: {
        prediction: { type: "string", description: "The falsifiable claim." },
        confidence: { type: "integer", description: "Confidence 0-100." },
        source: { type: "string", enum: ["user", "agent"] },
        resolution_date: {
          type: "string",
          format: "date",
          description: "Date the prediction resolves on (YYYY-MM-DD).",
        },
        reasoning: {
          type: "string",
          description:
            "Brief note on the pattern or evidence that led to this prediction. Recommended for agent rows; optional for user rows.",
        },
        project_id: { type: "string", description: "Project to file this prediction under (see list_projects)." },
        hypothesis_id: { type: "string", description: "Hypothesis this prediction bears on (see get_hypotheses)." },
      },
      required: ["prediction", "confidence", "source", "resolution_date"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}update_prediction`,
    description:
      "Update a prediction — the single write verb for any prediction change after creation.\n\n" +
      "Resolve it by setting `outcome` (+ an optional `resolution` note on what actually happened); `resolved_at` is auto-stamped by trigger. Re-file it by setting `project_id` / `hypothesis_id` (pass null to unlink). Edit content (`prediction` / `confidence` / `reasoning` / `resolution_date`) only while still open — once an outcome is set those fields are immutable (the trigger raises on edit).\n\n" +
      "outcome values: `hit` (substantively true) | `miss` (substantively false) | `unresolvable` (reality genuinely can't be determined — a first-class option, better than fabricating hit/miss). Pass outcome=null to reopen.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Prediction UUID." },
        prediction: { type: "string", description: "Edit the claim. Only allowed while unresolved." },
        confidence: { type: "integer", description: "0-100. Only allowed while unresolved." },
        reasoning: { type: "string", description: "Only editable while unresolved." },
        resolution_date: { type: "string", format: "date" },
        outcome: {
          type: ["string", "null"],
          enum: ["hit", "miss", "unresolvable", null],
          description: "Set to resolve; null to reopen.",
        },
        resolution: {
          type: "string",
          description: "Short note (1-2 sentences) on what actually happened.",
        },
        project_id: { type: ["string", "null"], description: "Project to file this under, or null to remove from its project." },
        hypothesis_id: { type: ["string", "null"], description: "Hypothesis this bears on, or null to unlink." },
      },
      required: ["id"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}list_predictions`,
    description:
      "List predictions, with filtering. Default order: `resolution_date` ascending, then `created_at` descending tiebreak. Use this at the start of a daily/weekly session to find anything that needs resolving (filter `status=open`, optionally constrained by date with to_date=today).\n\n" +
      "status filter: `open` (outcome IS NULL) or `resolved` (outcome IS NOT NULL).",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["user", "agent"] },
        status: { type: "string", enum: ["open", "resolved"] },
        from_date: {
          type: "string",
          format: "date",
          description: "Filter rows where `resolution_date >= from_date`.",
        },
        to_date: {
          type: "string",
          format: "date",
          description: "Filter rows where `resolution_date <= to_date`.",
        },
        project_id: { type: "string", description: "Filter to predictions in this project." },
        hypothesis_id: { type: "string", description: "Filter to predictions linked to this hypothesis." },
        limit: { type: "number", description: "Defaults to 50." },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}log_mood`,
    description:
      "Insert a mood snapshot. Two independent 1-7 scales: `mood` (valence) and `energy`. `note` is optional freeform context. Returns the inserted row.",
    inputSchema: {
      type: "object",
      properties: {
        mood: { type: "integer", description: "Mood/valence, 1-7." },
        energy: { type: "integer", description: "Energy, 1-7." },
        note: { type: "string" },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}create_journal_entry`,
    description:
      "Create a journal entry — a dated free-form note. Returns the row.",
    inputSchema: {
      type: "object",
      properties: {
        entry_date: { type: "string", format: "date" },
        content: { type: "string" },
      },
      required: ["entry_date", "content"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}update_journal_entry`,
    description:
      "Update the content of a journal entry by id. Returns the updated row.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID of the journal entry to update." },
        content: { type: "string" },
      },
      required: ["id", "content"],
    },
  },
  // ── Rationality write tools ─────────────────────────────────────────────
  {
    name: `${MCP_TOOL_PREFIX}create_decision`,
    description:
      "Open a new decision (durable, multi-day deliberation). options is an array of {name, notes?}. review_date is optional at open and required when calling decide. Returns the created decision.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        context: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, notes: { type: "string" } },
          },
        },
        review_date: { type: "string", format: "date" },
        project_id: { type: "string", description: "Project to file this decision under (see list_projects)." },
      },
      required: ["title", "context"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}update_decision`,
    description:
      "Update an open decision. Editing options is locked once status leaves 'open' — late additions belong in append_decision_note. Returns the updated decision.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        context: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, notes: { type: "string" } },
          },
        },
        review_date: { type: "string", format: "date" },
        project_id: { type: ["string", "null"], description: "Project to file this under, or null to remove from its project." },
      },
      required: ["id"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}append_decision_note`,
    description:
      "Append a consideration to a decision. Append-only; prior notes are never edited. Bumps the parent decision's updated_at. Returns the created note.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        note: { type: "string" },
      },
      required: ["id", "note"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}decide`,
    description:
      "Commit a decision: set chosen_option, rationale, and review_date. Only valid on a decision with status='open'. After this the decision moves to status='decided' and options are locked. Returns the updated decision.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        chosen_option: { type: "string" },
        rationale: { type: "string" },
        review_date: { type: "string", format: "date" },
      },
      required: ["id", "chosen_option", "rationale", "review_date"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}review_decision`,
    description:
      "Close the loop on a decided decision. Only valid on status='decided' with reviewed_at IS NULL. Returns the updated decision.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        outcome: {
          type: "string",
          enum: ["good_call", "wrong_call", "partial", "inconclusive"],
        },
        review_notes: { type: "string" },
      },
      required: ["id", "outcome", "review_notes"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}create_hypothesis`,
    description:
      "Create a new hypothesis (a living belief with a 0-100 credence). Optionally attach to a decision via decision_id. basis is prior conditioning — why you set the initial credence where you did. Returns the created hypothesis.",
    inputSchema: {
      type: "object",
      properties: {
        statement: { type: "string" },
        current_credence: { type: "integer", description: "0-100." },
        basis: { type: "string", description: "Prior conditioning — what led to this initial credence." },
        decision_id: { type: "string" },
        project_id: { type: "string", description: "Project to file this hypothesis under (see list_projects)." },
      },
      required: ["statement", "current_credence"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}update_hypothesis`,
    description:
      "Update a hypothesis. Patches statement, current_credence, or basis. Pass archived=true to soft-archive (sets archived_at), archived=false to restore. Prefer append_hypothesis_evidence for credence changes — direct edits skip the evidence trail. Returns the updated hypothesis.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        statement: { type: "string" },
        current_credence: { type: "integer", description: "0-100. Prefer append_hypothesis_evidence for tracked credence changes." },
        basis: { type: "string" },
        archived: { type: "boolean", description: "true → soft-archive (sets archived_at), false → restore (clears archived_at)." },
        project_id: { type: ["string", "null"], description: "Project to file this under, or null to remove from its project." },
      },
      required: ["id"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}append_hypothesis_evidence`,
    description:
      "Log evidence that shifts credence. Pass the new credence (posterior_credence) and a note explaining why. The service auto-reads the current credence as prior_credence, records both on the evidence row, then syncs the hypothesis's current_credence. This is the primary way credence should change. Returns the created evidence row.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Hypothesis UUID." },
        note: { type: "string", description: "What changed and why." },
        posterior_credence: { type: "integer", description: "New credence after this evidence (0-100)." },
      },
      required: ["id", "note", "posterior_credence"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}create_experiment`,
    description:
      "Open a new experiment with a protocol, success criteria, and date range. Optionally link to one or more hypotheses via hypothesis_ids array. Returns the created experiment.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        protocol: { type: "string" },
        start_date: { type: "string", format: "date" },
        end_date: { type: "string", format: "date" },
        success_criteria: { type: "string" },
        hypothesis_ids: { type: "array", items: { type: "string" } },
        project_id: { type: "string", description: "Project to file this experiment under (see list_projects)." },
      },
      required: ["title", "protocol", "start_date"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}update_experiment`,
    description:
      "Edit an experiment or close it out. When setting status to 'concluded' or 'abandoned', conclusion is required. Pass hypothesis_ids to replace the full set of linked hypotheses. Returns the updated experiment.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        protocol: { type: "string" },
        success_criteria: { type: "string" },
        end_date: { type: "string", format: "date" },
        hypothesis_ids: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["running", "concluded", "abandoned"] },
        conclusion: { type: "string" },
        project_id: { type: ["string", "null"], description: "Project to file this under, or null to remove from its project." },
      },
      required: ["id"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}log_experiment`,
    description:
      "Append a text observation to an experiment. Each call creates an independent entry — multiple observations per day are fine. logged_at defaults to now; pass an ISO timestamp to backfill. Returns the created log row.",
    inputSchema: {
      type: "object",
      properties: {
        experiment_id: { type: "string" },
        note: { type: "string" },
        logged_at: { type: "string", format: "date-time" },
      },
      required: ["experiment_id", "note"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}log_goal`,
    description:
      "Append a text update to a goal's activity timeline — progress notes, blockers, decisions, or the reason behind a status change. Each call creates an independent entry. Status transitions (open/done/failed/dropped) are logged automatically by update_goal, so you don't log those here; use this for the narrative of how the goal is going. Fetch the full timeline via get_goals with an id. logged_at defaults to now; pass an ISO timestamp to backfill. Returns the created log row.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string" },
        note: { type: "string" },
        logged_at: { type: "string", format: "date-time" },
      },
      required: ["goal_id", "note"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}create_project`,
    description:
      "Create a new project — a lightweight container that groups related work (tasks, goals, decisions, hypotheses, experiments, predictions). Both name and description are optional. New projects are active by default. Returns the created project; use its id as the project_id on the create/update write tools to file items under it.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short project name." },
        description: { type: "string", description: "What this project is about." },
      },
    },
  },
];

// ── Handlers ──────────────────────────────────────────────────────────────

async function createGoal(c: ScopedClient, p: Params) {
  const goalRow = {
    title: p.title,
    notes: p.notes ?? null,
    parent_goal_id: p.parent_goal_id ?? null,
    review_date: p.review_date ?? null,
    project_id: p.project_id ?? null,
  };

  const { data: goal, error } = await c
    .from("goals")
    .insert(goalRow)
    .select()
    .single();
  if (error) throw error;
  return { goal };
}

async function updateGoal(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const { data: existing } = await c
    .from("goals")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(
      `Goal with id "${id}" not found. Would you like to create a new goal instead?`,
    );
  }

  const patch: Record<string, unknown> = { updated_at: isoNow() };
  if (p.title !== undefined) patch.title = p.title;
  if (p.notes !== undefined) patch.notes = p.notes;
  if (p.review_date !== undefined) patch.review_date = p.review_date;
  if (p.parent_goal_id !== undefined) patch.parent_goal_id = p.parent_goal_id;
  if (p.project_id !== undefined) patch.project_id = p.project_id;
  if (p.status !== undefined) {
    patch.status = p.status;
    if (p.status !== null) {
      patch.closed_at = isoNow();
    } else {
      patch.closed_at = null;
    }
  }

  const { data, error } = await c
    .from("goals")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  // Record status transitions on the goal's timeline (mirrors
  // src/services/goalService.ts updateGoal).
  const prevStatus = (existing as { status: string | null }).status ?? null;
  if (p.status !== undefined && p.status !== prevStatus) {
    await c.from("goal_logs").insert({
      goal_id: id,
      kind: "status_change",
      from_status: prevStatus,
      to_status: p.status ?? null,
    });
  }

  return { goal: data };
}

// Mirrors src/services/goalService.ts:253-281 (deleteGoal).
async function deleteGoal(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const strategy = (p.strategy as string | undefined) ?? "unlink";

  const { data: existing } = await c
    .from("goals")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(
      `Goal with id "${id}" not found. It may have already been deleted.`,
    );
  }

  const subGoalIds: string[] = [];

  if (strategy === "cascade") {
    // Recursively delete sub-goals. parent_goal_id FK is RESTRICT, so we
    // must clear children before deleting the parent. Bound recursion depth
    // with a Set so a corrupted cycle can't lock the function up.
    const seen = new Set<string>();
    async function cascade(targetId: string): Promise<void> {
      if (seen.has(targetId)) return;
      seen.add(targetId);
      const { data: children } = await c
        .from("goals")
        .select("id")
        .eq("parent_goal_id", targetId);
      for (const child of (children ?? []) as { id: string }[]) {
        subGoalIds.push(child.id);
        await cascade(child.id);
      }
    }
    await cascade(id);

    // Delete in reverse so leaves go before their parents.
    for (const childId of [...subGoalIds].reverse()) {
      const { error } = await c.from("goals").delete().eq("id", childId);
      if (error) throw error;
    }
  } else {
    const { error: unlinkErr } = await c
      .from("goals")
      .update({ parent_goal_id: null, updated_at: isoNow() })
      .eq("parent_goal_id", id);
    if (unlinkErr) throw unlinkErr;
  }

  const { error } = await c.from("goals").delete().eq("id", id);
  if (error) throw error;

  return { deleted_id: id, strategy, sub_goal_ids: subGoalIds };
}

// Mirrors src/services/taskService.ts:65-79, 162-172 (createTask).
async function createTask(c: ScopedClient, p: Params) {
  if (!p.scheduled_date) throw new ValidationError("scheduled_date is required.");
  const row: Record<string, unknown> = {
    title: p.title,
    status: "open",
    scheduled_date: p.scheduled_date,
    due_date: p.due_date ?? null,
    goal_id: p.goal_id ?? null,
    estimated_minutes: p.estimated_minutes ?? null,
    notes: p.notes ?? null,
    project_id: p.project_id ?? null,
  };
  if ("linear_ticket_id" in p) row.linear_ticket_id = p.linear_ticket_id ?? null;
  const { data, error } = await c
    .from("tasks")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return { task: data };
}

// Mirrors src/services/taskService.ts:81-111, 174-178 (updateTask +
// buildUpdatePayload). Auto-sets completed_at / discarded_at on status changes.
// When status='done' on a task with a recurrence_rule, advances the schedule
// to the next occurrence and logs a row in recurrence_completions instead of
// marking the task done. Mirrors src/services/recurrenceService.ts:11-48
// (completeRecurring) + src/hooks/useTasks.ts:102-114 (which branches on
// recurrence_rule presence before completing).
async function updateTask(c: ScopedClient, p: Params) {
  const id = String(p.id);
  if (p.scheduled_date === null || p.scheduled_date === "") {
    throw new ValidationError("scheduled_date cannot be cleared; pass a date to reschedule.");
  }
  const { data: existing } = await c
    .from("tasks")
    .select("id, recurrence_rule, scheduled_date")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(
      `Task with id "${id}" not found. Would you like to create a new task instead?`,
    );
  }

  const now = isoNow();
  const recurrenceRule = (
    existing as { recurrence_rule: RecurrenceRule | null }
  ).recurrence_rule;
  const currentScheduledDate = (
    existing as { scheduled_date: string }
  ).scheduled_date;

  // Recurring-task completion path: advance schedule, log completion, keep open.
  if (p.status === "done" && recurrenceRule) {
    const referenceDate =
      getRecurrenceAnchor(recurrenceRule) === "completion"
        ? now.slice(0, 10)
        : currentScheduledDate;
    const nextDate = getNextRecurringDate({
      rule: recurrenceRule,
      referenceDate,
    });

    const { error: logErr } = await c
      .from("recurrence_completions")
      .insert({
        task_id: id,
        scheduled_for: currentScheduledDate,
      });
    if (logErr) throw logErr;

    const patch: Record<string, unknown> = {
      scheduled_date: nextDate,
      completed_at: null,
      status: "open",
      updated_at: now,
    };
    if (p.title !== undefined) patch.title = p.title;
    if (p.notes !== undefined) patch.notes = p.notes;
    if (p.due_date !== undefined) patch.due_date = p.due_date;
    if ("linear_ticket_id" in p) patch.linear_ticket_id = p.linear_ticket_id ?? null;
    if (p.project_id !== undefined) patch.project_id = p.project_id;

    const { data, error } = await c
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return { task: data };
  }

  const patch: Record<string, unknown> = { updated_at: now };
  if (p.title !== undefined) patch.title = p.title;
  if (p.status !== undefined) patch.status = p.status;
  if (p.scheduled_date !== undefined) patch.scheduled_date = p.scheduled_date;
  if (p.due_date !== undefined) patch.due_date = p.due_date;
  if (p.notes !== undefined) patch.notes = p.notes;
  if ("linear_ticket_id" in p) patch.linear_ticket_id = p.linear_ticket_id ?? null;
  if (p.project_id !== undefined) patch.project_id = p.project_id;
  if (p.status === "done") patch.completed_at = now;
  if (p.status === "discarded") patch.discarded_at = now;
  // Reopening undoes a completion or discard cleanly — clear both stamps so an
  // accidental done/discarded round-trips back to a clean open task.
  if (p.status === "open") {
    patch.completed_at = null;
    patch.discarded_at = null;
  }

  const { data, error } = await c
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return { task: data };
}

// Generic hard delete by id. The rationality tables were built delete-safe
// (child rows ON DELETE CASCADE, cross-primitive links ON DELETE SET NULL); the
// tasks table likewise cascades completions / session links and nulls nullable
// references. So each supported entity is a plain DELETE — RLS scopes it to the
// caller's own rows, so the existence check and delete only ever touch the
// user's data. Goals are excluded: their parent_goal_id FK is RESTRICT and
// needs the recursive cascade/unlink strategy in delete_goal.
const DELETABLE_TABLES: Record<string, string> = {
  decision: "decisions",
  hypothesis: "hypotheses",
  experiment: "experiments",
  prediction: "predictions",
  task: "tasks",
  journal_entry: "journal_entries",
};

async function deleteEntity(c: ScopedClient, p: Params) {
  const entity = String(p.entity);
  const table = DELETABLE_TABLES[entity];
  if (!table) {
    throw new ValidationError(
      `delete does not support entity "${entity}". Supported: ${Object.keys(DELETABLE_TABLES).join(", ")}. To delete a goal, use delete_goal.`,
    );
  }
  const id = String(p.id);

  const { data: existing } = await c
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(`${entity} with id "${id}" not found.`);
  }

  const { error } = await c.from(table).delete().eq("id", id);
  if (error) throw error;
  return { deleted: true, entity, id };
}

// First-class prediction handlers — back the `predictions` table.

async function createPrediction(c: ScopedClient, p: Params) {
  if (!p.prediction) throw new ValidationError("prediction is required.");
  if (p.confidence === undefined) throw new ValidationError("confidence is required.");

  const row: Record<string, unknown> = {
    prediction: p.prediction,
    confidence: p.confidence,
    reasoning: p.reasoning ?? null,
    source: p.source,
    resolution_date: p.resolution_date,
    project_id: p.project_id ?? null,
    hypothesis_id: p.hypothesis_id ?? null,
  };
  const { data, error } = await c
    .from("predictions")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return { prediction: data };
}

async function updatePrediction(c: ScopedClient, p: Params) {
  const id = String(p.id);

  const { data: existing } = await c
    .from("predictions")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(`Prediction with id "${id}" not found.`);
  }

  const patch: Record<string, unknown> = { updated_at: isoNow() };
  if (p.prediction !== undefined) patch.prediction = p.prediction;
  if (p.confidence !== undefined) patch.confidence = p.confidence;
  if (p.reasoning !== undefined) patch.reasoning = p.reasoning;
  if (p.resolution_date !== undefined) patch.resolution_date = p.resolution_date;
  if (p.outcome !== undefined) patch.outcome = p.outcome;
  if (p.resolution !== undefined) patch.resolution = p.resolution;
  if (p.project_id !== undefined) patch.project_id = p.project_id;
  if (p.hypothesis_id !== undefined) patch.hypothesis_id = p.hypothesis_id;

  // The DB trigger enforces post-resolution content immutability and stamps
  // resolved_at; surface its rejection as a clean validation error.
  const { data, error } = await c
    .from("predictions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (/after resolution/i.test(error.message ?? "")) {
      throw new ValidationError(
        "Cannot edit prediction/confidence/reasoning after the prediction is resolved. Reopen it (outcome=null) first, or only change outcome/resolution/links.",
      );
    }
    throw error;
  }
  return { prediction: data };
}

// ── Rationality write handlers ────────────────────────────────────────────
// Mirrors src/services/{decision,hypothesis,experiment}Service.ts +
// src/services/agentToolService.ts:1535+ (the *Tool wrappers).

async function createDecisionHandler(c: ScopedClient, p: Params) {
  const { data, error } = await c
    .from("decisions")
    .insert({
      title: p.title,
      context: p.context,
      options: p.options ?? [],
      review_date: p.review_date ?? null,
      project_id: p.project_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return { decision: data };
}

async function updateDecisionHandler(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const { data: existing } = await c
    .from("decisions")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(`Decision with id "${id}" not found.`);
  }
  if (p.options !== undefined && existing.status !== "open") {
    throw new ValidationError(
      `Cannot edit options on a ${existing.status} decision. Append a note instead.`,
    );
  }
  const patch: Record<string, unknown> = { updated_at: isoNow() };
  if (p.title !== undefined) patch.title = p.title;
  if (p.context !== undefined) patch.context = p.context;
  if (p.options !== undefined) patch.options = p.options;
  if (p.review_date !== undefined) patch.review_date = p.review_date;
  if (p.project_id !== undefined) patch.project_id = p.project_id;
  const { data, error } = await c
    .from("decisions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return { decision: data };
}

async function listPredictions(c: ScopedClient, p: Params) {
  const limit = p.limit !== undefined ? Number(p.limit) : 50;
  let q = c.from("predictions").select("*");

  if (p.source) q = q.eq("source", p.source);
  if (p.status === "open") q = q.is("outcome", null);
  if (p.status === "resolved") q = q.not("outcome", "is", null);
  if (p.from_date) q = q.gte("resolution_date", p.from_date);
  if (p.to_date) q = q.lte("resolution_date", p.to_date);
  if (p.project_id) q = q.eq("project_id", p.project_id);
  if (p.hypothesis_id) q = q.eq("hypothesis_id", p.hypothesis_id);

  const { data, error } = await q
    .order("resolution_date", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return { predictions: data ?? [] };
}

// Mood and journal handlers — back the mood_logs and journal_entries tables.

async function logMood(c: ScopedClient, p: Params) {
  const row: Record<string, unknown> = { context: "manual" };
  if (p.mood !== undefined) row.mood_rating = p.mood;
  if (p.energy !== undefined) row.energy_rating = p.energy;
  if (p.note !== undefined) row.note = p.note;
  const { data, error } = await c
    .from("mood_logs")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return { mood_log: data };
}

async function createJournalEntry(c: ScopedClient, p: Params) {
  if (!p.entry_date) throw new ValidationError("entry_date is required.");
  const entryDate = String(p.entry_date);
  const content = (p.content as string | undefined) ?? "";
  const now = isoNow();

  const { data, error } = await c
    .from("journal_entries")
    .insert({ entry_date: entryDate, content, updated_at: now })
    .select()
    .single();
  if (error) throw error;
  return { journal_entry: data };
}

async function updateJournalEntry(c: ScopedClient, p: Params) {
  if (!p.id) throw new ValidationError("id is required.");
  if (p.content === undefined) throw new ValidationError("content is required.");
  const id = String(p.id);

  const { data: existing } = await c
    .from("journal_entries")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(`Journal entry with id "${id}" not found.`);
  }

  const { data, error } = await c
    .from("journal_entries")
    .update({ content: p.content, updated_at: isoNow() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return { journal_entry: data };
}

async function appendDecisionNoteHandler(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const { data: existing } = await c
    .from("decisions")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(`Decision with id "${id}" not found.`);
  }
  const { data: note, error } = await c
    .from("decision_notes")
    .insert({ decision_id: id, note: p.note })
    .select()
    .single();
  if (error) throw error;

  await c.from("decisions").update({ updated_at: isoNow() }).eq("id", id);
  return { note };
}

async function decideHandler(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const { data: existing } = await c
    .from("decisions")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(`Decision with id "${id}" not found.`);
  }
  if (existing.status !== "open") {
    throw new ValidationError(
      `Decision is already ${existing.status}. Only open decisions can be decided.`,
    );
  }
  const now = isoNow();
  const { data, error } = await c
    .from("decisions")
    .update({
      status: "decided",
      chosen_option: p.chosen_option,
      rationale: p.rationale,
      review_date: p.review_date,
      decided_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return { decision: data };
}

async function reviewDecisionHandler(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const { data: existing } = await c
    .from("decisions")
    .select("id, status, reviewed_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(`Decision with id "${id}" not found.`);
  }
  if (existing.status !== "decided") {
    throw new ValidationError(
      `Only decided decisions can be reviewed. This one is ${existing.status}.`,
    );
  }
  if (existing.reviewed_at) {
    throw new ValidationError(
      `Decision was already reviewed on ${existing.reviewed_at}.`,
    );
  }
  const now = isoNow();
  const { data, error } = await c
    .from("decisions")
    .update({
      reviewed_at: now,
      review_outcome: p.outcome,
      review_notes: p.review_notes,
      updated_at: now,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return { decision: data };
}

async function createHypothesisHandler(c: ScopedClient, p: Params) {
  const { data, error } = await c
    .from("hypotheses")
    .insert({
      statement: p.statement,
      current_credence: p.current_credence,
      basis: p.basis ?? null,
      decision_id: p.decision_id ?? null,
      project_id: p.project_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return { hypothesis: data };
}

async function updateHypothesisHandler(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const now = isoNow();
  const patch: Record<string, unknown> = { updated_at: now };
  if (p.statement !== undefined) patch.statement = p.statement;
  if (p.current_credence !== undefined) patch.current_credence = p.current_credence;
  if (p.basis !== undefined) patch.basis = p.basis;
  if (p.project_id !== undefined) patch.project_id = p.project_id;
  if (p.archived === true) patch.archived_at = now;
  else if (p.archived === false) patch.archived_at = null;
  const { data, error } = await c
    .from("hypotheses")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  if (!data) {
    throw new NotFoundError(`Hypothesis with id "${id}" not found.`);
  }
  return { hypothesis: data };
}

async function appendHypothesisEvidenceHandler(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const { data: existing } = await c
    .from("hypotheses")
    .select("id, current_credence")
    .eq("id", id)
    .maybeSingle();
  if (!existing) {
    throw new NotFoundError(`Hypothesis with id "${id}" not found.`);
  }
  const priorCredence = (existing as { current_credence: number }).current_credence;

  const { data: evidence, error } = await c
    .from("hypothesis_evidence")
    .insert({
      hypothesis_id: id,
      note: p.note,
      prior_credence: priorCredence,
      posterior_credence: p.posterior_credence,
    })
    .select()
    .single();
  if (error) throw error;

  const now = isoNow();
  await c.from("hypotheses").update({
    current_credence: p.posterior_credence,
    updated_at: now,
  }).eq("id", id);
  return { evidence };
}

async function createExperimentHandler(c: ScopedClient, p: Params) {
  const { data, error } = await c
    .from("experiments")
    .insert({
      title: p.title,
      protocol: p.protocol,
      start_date: p.start_date,
      end_date: p.end_date ?? null,
      success_criteria: p.success_criteria ?? null,
      project_id: p.project_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const ids: string[] = Array.isArray(p.hypothesis_ids) ? p.hypothesis_ids : [];
  if (ids.length > 0) {
    const { error: linkErr } = await c
      .from("experiment_hypotheses")
      .insert(ids.map((hid: string) => ({ experiment_id: data.id, hypothesis_id: hid })));
    if (linkErr) throw linkErr;
  }

  return { experiment: { ...data, hypothesis_ids: ids } };
}

async function updateExperimentHandler(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const terminal = p.status === "concluded" || p.status === "abandoned";
  if (terminal && !p.conclusion) {
    throw new ValidationError("conclusion is required when concluding or abandoning an experiment.");
  }
  const now = isoNow();
  const patch: Record<string, unknown> = { updated_at: now };
  if (p.title !== undefined) patch.title = p.title;
  if (p.protocol !== undefined) patch.protocol = p.protocol;
  if (p.success_criteria !== undefined) patch.success_criteria = p.success_criteria;
  if (p.end_date !== undefined) patch.end_date = p.end_date;
  if (p.status !== undefined) patch.status = p.status;
  if (p.conclusion !== undefined) patch.conclusion = p.conclusion;
  if (p.project_id !== undefined) patch.project_id = p.project_id;
  if (terminal) patch.concluded_at = now;
  const { data, error } = await c
    .from("experiments")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Experiment with id "${id}" not found.`);

  if (Array.isArray(p.hypothesis_ids)) {
    await c.from("experiment_hypotheses").delete().eq("experiment_id", id);
    const ids: string[] = p.hypothesis_ids;
    if (ids.length > 0) {
      const { error: linkErr } = await c
        .from("experiment_hypotheses")
        .insert(ids.map((hid: string) => ({ experiment_id: id, hypothesis_id: hid })));
      if (linkErr) throw linkErr;
    }
    return { experiment: { ...data, hypothesis_ids: ids } };
  }

  const { data: links } = await c
    .from("experiment_hypotheses")
    .select("hypothesis_id")
    .eq("experiment_id", id);
  return { experiment: { ...data, hypothesis_ids: (links ?? []).map((l: { hypothesis_id: string }) => l.hypothesis_id) } };
}

async function logExperimentHandler(c: ScopedClient, p: Params) {
  if (!p.experiment_id) {
    throw new ValidationError("experiment_id is required.");
  }
  if (!p.note) {
    throw new ValidationError("note is required.");
  }
  const { data, error } = await c
    .from("experiment_logs")
    .insert({
      experiment_id: p.experiment_id,
      note: p.note,
      logged_at: p.logged_at ?? isoNow(),
    })
    .select()
    .single();
  if (error) throw error;
  return { log: data };
}

async function logGoalHandler(c: ScopedClient, p: Params) {
  if (!p.goal_id) {
    throw new ValidationError("goal_id is required.");
  }
  if (!p.note) {
    throw new ValidationError("note is required.");
  }
  const { data, error } = await c
    .from("goal_logs")
    .insert({
      goal_id: p.goal_id,
      kind: "note",
      note: p.note,
      logged_at: p.logged_at ?? isoNow(),
    })
    .select()
    .single();
  if (error) throw error;
  return { log: data };
}

async function createProject(c: ScopedClient, p: Params) {
  const projectRow = {
    name: p.name ?? null,
    description: p.description ?? null,
  };

  const { data: project, error } = await c
    .from("projects")
    .insert(projectRow)
    .select()
    .single();
  if (error) throw error;
  return { project };
}

// ── Linear integration write handlers ─────────────────────────────────────

function parseLinearIdentifier(identifier: string): { team_key: string } {
  const idx = identifier.indexOf("-");
  if (idx <= 0) {
    throw new ValidationError(
      `Invalid Linear identifier "${identifier}". Expected a team-prefixed form like "WIL-123".`,
    );
  }
  return { team_key: identifier.slice(0, idx).toUpperCase() };
}

async function findOrCreateLinearTicket(c: ScopedClient, identifier: string) {
  const { data: existing, error: existErr } = await c
    .from("linear_tickets")
    .select("*")
    .eq("identifier", identifier)
    .maybeSingle();
  if (existErr) throw existErr;
  if (existing) return { ticket: existing, was_created: false };

  const { team_key } = parseLinearIdentifier(identifier);
  const { data, error } = await c
    .from("linear_tickets")
    .insert({ identifier, team_key })
    .select()
    .single();
  if (error) throw error;
  return { ticket: data, was_created: true };
}


export const WRITE_HANDLERS: Record<
  string,
  (c: ScopedClient, p: Params) => Promise<unknown>
> = {
  [`${MCP_TOOL_PREFIX}create_goal`]: createGoal,
  [`${MCP_TOOL_PREFIX}update_goal`]: updateGoal,
  [`${MCP_TOOL_PREFIX}delete_goal`]: deleteGoal,
  [`${MCP_TOOL_PREFIX}create_task`]: createTask,
  [`${MCP_TOOL_PREFIX}update_task`]: updateTask,
  [`${MCP_TOOL_PREFIX}delete`]: deleteEntity,
  [`${MCP_TOOL_PREFIX}create_prediction`]: createPrediction,
  [`${MCP_TOOL_PREFIX}update_prediction`]: updatePrediction,
  [`${MCP_TOOL_PREFIX}list_predictions`]: listPredictions,
  [`${MCP_TOOL_PREFIX}log_mood`]: logMood,
  [`${MCP_TOOL_PREFIX}create_journal_entry`]: createJournalEntry,
  [`${MCP_TOOL_PREFIX}update_journal_entry`]: updateJournalEntry,
  [`${MCP_TOOL_PREFIX}create_decision`]: createDecisionHandler,
  [`${MCP_TOOL_PREFIX}update_decision`]: updateDecisionHandler,
  [`${MCP_TOOL_PREFIX}append_decision_note`]: appendDecisionNoteHandler,
  [`${MCP_TOOL_PREFIX}decide`]: decideHandler,
  [`${MCP_TOOL_PREFIX}review_decision`]: reviewDecisionHandler,
  [`${MCP_TOOL_PREFIX}create_hypothesis`]: createHypothesisHandler,
  [`${MCP_TOOL_PREFIX}update_hypothesis`]: updateHypothesisHandler,
  [`${MCP_TOOL_PREFIX}append_hypothesis_evidence`]: appendHypothesisEvidenceHandler,
  [`${MCP_TOOL_PREFIX}create_experiment`]: createExperimentHandler,
  [`${MCP_TOOL_PREFIX}update_experiment`]: updateExperimentHandler,
  [`${MCP_TOOL_PREFIX}log_experiment`]: logExperimentHandler,
  [`${MCP_TOOL_PREFIX}log_goal`]: logGoalHandler,
  [`${MCP_TOOL_PREFIX}create_project`]: createProject,
};
