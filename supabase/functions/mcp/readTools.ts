// MCP read-tool definitions and handlers.
//
// Schemas duplicate the canonical descriptors in
// src/services/agentToolDefinitions.ts because Deno can't import the
// browser-side TS (which uses @ aliases and skill-registry glob imports).
//
// Implementations are deliberately simpler than the in-app agent's: direct
// table reads, no deep enrichment, no per-day stitching. Good enough for an
// external client to ground a conversation; the heavy composition tools can
// be ported later as their value becomes clearer.

import type { ScopedClient } from "./scopedClient.ts";
import {
  addDays,
  NotFoundError,
  ValidationError,
} from "./helpers.ts";
import { SKILLS } from "./skills.generated.ts";
import { MCP_TOOL_PREFIX, type Params, type ToolDef } from "./toolTypes.ts";

export const READ_TOOLS: ToolDef[] = [
  {
    name: `${MCP_TOOL_PREFIX}get_goals`,
    description:
      "Retrieve the user's goals. Pass id to fetch a single goal — the response includes its progress_log, a timeline of text updates and automatic status transitions, oldest first. List reads omit the log. Goals with status=NULL are open; closed goals have status done/failed/dropped. Pass open=true to get only open goals, or filter by a specific closed status.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Fetch a single goal by id." },
        open: { type: "boolean", description: "If true, return only open goals (status IS NULL)." },
        status: {
          type: "string",
          enum: ["done", "failed", "dropped"],
          description: "Filter by closed status. Ignored if open=true.",
        },
        review_before: { type: "string", format: "date", description: "Goals with review_date on or before this date." },
        review_after: { type: "string", format: "date", description: "Goals with review_date on or after this date." },
        parent_goal_id: { type: "string", description: "Filter by parent goal. Pass 'null' for root goals." },
        project_id: { type: "string", description: "Filter to goals in this project." },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}get_tasks`,
    description:
      "Retrieve tasks. Date range filter checks scheduled_date OR due_date. Pass id to fetch a single task. Every task has a scheduled_date. Includes estimated_minutes and actual_minutes. " +
      "Recurring tasks (recurrence_rule set) are never marked status='done' on completion — instead each completion is logged and scheduled_date is advanced to the next occurrence, so the task stays open. Such a task carries a recurrence_completions array (most recent first; each entry has completed_at and scheduled_for) — a non-empty list means the user has been completing it, NOT that they manually moved/rescheduled it. Manual moves are recorded separately in schedule_history. Don't infer a recurring task was rescheduled just because scheduled_date is in the future; check recurrence_completions first.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Fetch a single task by id." },
        from_date: { type: "string", format: "date" },
        to_date: { type: "string", format: "date" },
        status: { type: "string", enum: ["open", "done", "discarded"] },
        goal_id: { type: "string" },
        project_id: { type: "string", description: "Filter to tasks in this project." },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}list_journal_entries`,
    description:
      "List journal entries and mood logs for a date range — the combined record of thinking and emotional state over time. Journal entries ordered by entry_date desc, then created_at desc. Mood logs ordered by logged_at desc. Both default to limit 20 independently.",
    inputSchema: {
      type: "object",
      properties: {
        from_date: { type: "string", format: "date" },
        to_date: { type: "string", format: "date" },
        limit: { type: "number", description: "Applies to both journal entries and mood logs independently. Defaults to 20." },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}get_decisions`,
    description:
      "Retrieve the user's decisions (durable, multi-day deliberations). " +
      "Pass id to fetch a single decision with its full surface in one round-trip: decision row, append-only notes (oldest to newest), linked hypotheses with their evidence, and experiments linked through those hypotheses with their latest log. " +
      "Omit id to list decisions — each row carries title, context, options, status, chosen_option, rationale, review_date, and review outcome, most recently updated first.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Fetch a single decision with its full surface. When set, status/limit are ignored.",
        },
        status: {
          type: "string",
          enum: ["open", "decided", "abandoned"],
        },
        project_id: { type: "string", description: "Filter to decisions in this project." },
        limit: { type: "number" },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}get_hypotheses`,
    description:
      "List hypotheses (living beliefs with a 0-100 credence that updates via evidence). Each row carries its evidence log inline (with prior/posterior credence per entry). Filter by archived status, decision link, or search by statement text. Most recently updated first. Defaults to active (non-archived) hypotheses only.",
    inputSchema: {
      type: "object",
      properties: {
        decision_id: { type: "string" },
        archived: {
          type: "boolean",
          description: "true = archived only, false = active only (default).",
        },
        search: {
          type: "string",
          description: "Substring match on statement text.",
        },
        project_id: { type: "string", description: "Filter to hypotheses in this project." },
        limit: { type: "number" },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}get_experiments`,
    description:
      "Retrieve experiments (time-boxed tests with a protocol and success criteria). " +
      "Pass id to fetch a single experiment with its full daily log (oldest to newest by date). " +
      "Omit id to list experiments — each row carries the latest log inline so a client can spot a running experiment that hasn't been logged today, most recently updated first.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Fetch a single experiment with its full daily log. When set, status/limit are ignored.",
        },
        status: {
          type: "string",
          enum: ["running", "concluded", "abandoned"],
        },
        project_id: { type: "string", description: "Filter to experiments in this project." },
        limit: { type: "number" },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}query_work_by_ticket`,
    description:
      "Aggregate effort against a Linear ticket: cached ticket + linked tasks + focus sessions touching those tasks (with total minutes and session count). Optional since/until ISO timestamps narrow the session window.",
    inputSchema: {
      type: "object",
      properties: {
        ticket_identifier: { type: "string" },
        since: { type: "string", format: "date-time" },
        until: { type: "string", format: "date-time" },
      },
      required: ["ticket_identifier"],
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}list_linear_tickets`,
    description:
      "List Linear tickets cached locally. Optional filters: team_key (e.g. 'WIL'), status, and a row limit.",
    inputSchema: {
      type: "object",
      properties: {
        team_key: { type: "string" },
        status: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}list_projects`,
    description:
      "List the user's projects (lightweight containers that group related work). Each row carries id, name, description, and status (active | archived). Use the returned id as the project_id filter on get_tasks / get_goals / get_decisions / get_hypotheses / get_experiments / list_predictions, or to file new items into a project on the create/update write tools. Defaults to active projects; pass status='archived' or status='all' to widen.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "archived", "all"],
          description: "Defaults to 'active'.",
        },
      },
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}list_skills`,
    description:
      "List every skill loadable via read_skill: neutral built-in examples " +
      "and the " +
      "user's own skills created on the Skills page. Returns built-in skill " +
      "names and the user's skills (name + whether each overrides a built-in). " +
      "Call this to discover what's available before reading a specific skill.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: `${MCP_TOOL_PREFIX}read_skill`,
    description:
      "Read a skill file for detailed instructions.\n\n" +
      "Two kinds of skills:\n" +
      "1. **Built-in examples** covering planning, prediction review, and experiment review.\n" +
      "2. **User-created skills** — custom skills created by the user via the Skills page. Any kebab-case name is valid.\n\n" +
      "Call list_skills to enumerate everything available. Built-in skills: " + Object.keys(SKILLS).sort().join(", "),
    inputSchema: {
      type: "object",
      properties: {
        skill_name: {
          type: "string",
          description: "Name of the skill to load (built-in or user-created).",
        },
      },
      required: ["skill_name"],
    },
  },
];

// ── Handlers ──────────────────────────────────────────────────────────────

async function getGoals(c: ScopedClient, p: Params) {
  let q = c.from("goals").select("*").order("created_at", { ascending: false });
  if (p.id) q = q.eq("id", p.id);
  if (p.open) {
    q = q.is("status", null);
  } else if (p.status) {
    q = q.eq("status", p.status);
  }
  if (p.review_before) q = q.lte("review_date", p.review_before);
  if (p.review_after) q = q.gte("review_date", p.review_after);
  if (p.project_id) q = q.eq("project_id", p.project_id);
  if (p.parent_goal_id !== undefined) {
    if (p.parent_goal_id === "null") {
      q = q.is("parent_goal_id", null);
    } else {
      q = q.eq("parent_goal_id", p.parent_goal_id);
    }
  }
  const { data, error } = await q;
  if (error) throw error;

  // On a single-goal fetch, attach the goal's activity timeline (text updates
  // + status transitions, oldest first). List reads stay lean — no per-row
  // log fetch.
  if (p.id && data && data.length > 0) {
    const { data: logs, error: logErr } = await c
      .from("goal_logs")
      .select("*")
      .eq("goal_id", p.id)
      .order("logged_at", { ascending: true });
    if (logErr) throw logErr;
    return { goals: [{ ...data[0], progress_log: logs ?? [] }] };
  }

  return { goals: data ?? [] };
}

async function getTasks(c: ScopedClient, p: Params) {
  let q = c.from("tasks").select("*").order("scheduled_date", { ascending: true });
  if (p.id) q = q.eq("id", p.id);
  if (p.status) q = q.eq("status", p.status);
  if (p.goal_id) q = q.eq("goal_id", p.goal_id);
  if (p.project_id) q = q.eq("project_id", p.project_id);
  if (p.from_date) {
    q = q.or(`scheduled_date.gte.${p.from_date},due_date.gte.${p.from_date}`);
  }
  if (p.to_date) {
    q = q.or(`scheduled_date.lte.${p.to_date},due_date.lte.${p.to_date}`);
  }
  const { data, error } = await q;
  if (error) throw error;

  // Cast keeps the supabase-js GenericStringError union off the element type
  // (same pattern the handlers below use for maybeSingle results).
  const tasks = (data ?? []) as unknown as Record<string, unknown>[];

  // Recurring tasks never go status='done' — completions live in a separate
  // table and scheduled_date is advanced instead. Without this, a completed
  // recurring task is indistinguishable from one the user manually moved.
  // Attach each recurring task's recent completion log so the agent can tell
  // the difference. Manual reschedules remain visible in schedule_history.
  const recurringIds = tasks
    .filter((t) => (t as Record<string, unknown>).recurrence_rule != null)
    .map((t) => (t as Record<string, unknown>).id as string);

  if (recurringIds.length > 0) {
    const { data: completions, error: cErr } = await c
      .from("recurrence_completions")
      .select("task_id, completed_at, scheduled_for")
      .in("task_id", recurringIds)
      .order("completed_at", { ascending: false });
    if (cErr) throw cErr;

    const byTask = new Map<string, { completed_at: string; scheduled_for: string }[]>();
    for (const row of (completions ?? []) as {
      task_id: string;
      completed_at: string;
      scheduled_for: string;
    }[]) {
      const list = byTask.get(row.task_id) ?? [];
      // Cap at the 10 most recent per task to keep the payload bounded.
      if (list.length < 10) {
        list.push({ completed_at: row.completed_at, scheduled_for: row.scheduled_for });
        byTask.set(row.task_id, list);
      }
    }

    for (const t of tasks) {
      const rec = t as Record<string, unknown>;
      if (rec.recurrence_rule != null) {
        rec.recurrence_completions = byTask.get(rec.id as string) ?? [];
      }
    }
  }

  return { tasks };
}


async function listJournalEntries(c: ScopedClient, p: Params) {
  const limit = p.limit !== undefined ? Number(p.limit) : 20;

  let jq = c.from("journal_entries").select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (p.from_date) jq = jq.gte("entry_date", p.from_date);
  if (p.to_date) jq = jq.lte("entry_date", p.to_date);

  let mq = c.from("mood_logs").select("*")
    .order("logged_at", { ascending: false })
    .limit(limit);
  const dayStart = p.from_date ? `${p.from_date}T00:00:00` : undefined;
  const dayEnd = p.to_date ? `${addDays(p.to_date, 1)}T00:00:00` : undefined;
  if (dayStart) mq = mq.gte("logged_at", dayStart);
  if (dayEnd) mq = mq.lt("logged_at", dayEnd);

  const [journalRes, moodRes] = await Promise.all([jq, mq]);
  if (journalRes.error) throw journalRes.error;
  if (moodRes.error) throw moodRes.error;
  return {
    journal_entries: journalRes.data ?? [],
    mood_logs: moodRes.data ?? [],
  };
}

// Unified decisions read: id present → full single surface (notes + hypotheses
// + evidence + experiments + latest logs); id absent → list. Mirrors the
// get_tasks convention (one `id`-optional read instead of a singular/plural
// pair).
async function getDecisions(c: ScopedClient, p: Params) {
  if (p.id) return getDecisionDetail(c, p);
  let q = c.from("decisions").select("*").order("updated_at", { ascending: false });
  if (p.status) q = q.eq("status", p.status);
  if (p.project_id) q = q.eq("project_id", p.project_id);
  if (p.limit !== undefined) q = q.limit(Number(p.limit));
  const { data, error } = await q;
  if (error) throw error;
  return { decisions: data ?? [] };
}

async function getDecisionDetail(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const { data: decision, error: decErr } = await c
    .from("decisions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (decErr) throw decErr;
  if (!decision) {
    throw new NotFoundError(`Decision with id "${id}" not found.`);
  }

  const [notesRes, hyposRes] = await Promise.all([
    c.from("decision_notes")
      .select("*")
      .eq("decision_id", id)
      .order("created_at", { ascending: true }),
    c.from("hypotheses")
      .select("*")
      .eq("decision_id", id)
      .order("updated_at", { ascending: false }),
  ]);
  if (notesRes.error) throw notesRes.error;
  if (hyposRes.error) throw hyposRes.error;

  const hypotheses = (hyposRes.data ?? []) as Array<{ id: string }>;
  const hypoIds = hypotheses.map((h) => h.id);

  // Experiments linked to any of the decision's hypotheses via junction table.
  let expRows: Array<{ id: string }> = [];
  if (hypoIds.length > 0) {
    const { data: links, error: linkErr } = await c
      .from("experiment_hypotheses")
      .select("experiment_id")
      .in("hypothesis_id", hypoIds);
    if (linkErr) throw linkErr;
    const expIds = [...new Set((links ?? []).map((l: { experiment_id: string }) => l.experiment_id))];
    if (expIds.length > 0) {
      const { data, error: expErr } = await c.from("experiments")
        .select("*")
        .in("id", expIds)
        .order("updated_at", { ascending: false });
      if (expErr) throw expErr;
      expRows = (data ?? []) as Array<{ id: string }>;
    }
  }

  const latestByExp: Record<string, unknown> = {};
  if (expRows.length > 0) {
    const { data: logs, error: logErr } = await c
      .from("experiment_logs")
      .select("*")
      .in("experiment_id", expRows.map((e) => e.id))
      .order("logged_at", { ascending: false });
    if (logErr) throw logErr;
    for (const log of (logs ?? []) as Array<{ experiment_id: string }>) {
      if (!latestByExp[log.experiment_id]) latestByExp[log.experiment_id] = log;
    }
  }
  const experimentsWithLogs = expRows.map((e) => ({
    ...e,
    latest_log: latestByExp[e.id] ?? null,
  }));

  return {
    decision,
    notes: notesRes.data ?? [],
    hypotheses,
    experiments: experimentsWithLogs,
  };
}

async function getHypotheses(c: ScopedClient, p: Params) {
  let q = c.from("hypotheses").select("*").order("updated_at", { ascending: false });
  if (p.decision_id) q = q.eq("decision_id", p.decision_id);
  if (p.project_id) q = q.eq("project_id", p.project_id);
  if (p.archived === true) q = q.not("archived_at", "is", null);
  else q = q.is("archived_at", null);
  if (p.search) q = q.ilike("statement", `%${p.search}%`);
  if (p.limit !== undefined) q = q.limit(Number(p.limit));
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string }>;
  if (rows.length === 0) return { hypotheses: [] };

  const { data: evidence, error: evErr } = await c
    .from("hypothesis_evidence")
    .select("*")
    .in("hypothesis_id", rows.map((r) => r.id))
    .order("created_at", { ascending: true });
  if (evErr) throw evErr;

  const evidenceByHypo: Record<string, unknown[]> = {};
  for (const row of (evidence ?? []) as Array<{ hypothesis_id: string }>) {
    (evidenceByHypo[row.hypothesis_id] ??= []).push(row);
  }

  return {
    hypotheses: rows.map((h) => ({
      ...h,
      evidence: evidenceByHypo[h.id] ?? [],
    })),
  };
}

// Unified experiments read: id present → single experiment + full daily log;
// id absent → list with latest_log inline. Mirrors get_tasks / get_decisions.
async function enrichExperimentsWithHypothesisIds(
  c: ScopedClient,
  rows: Array<{ id: string }>,
): Promise<Array<{ id: string; hypothesis_ids: string[] }>> {
  if (rows.length === 0) return rows as Array<{ id: string; hypothesis_ids: string[] }>;
  const { data: links, error } = await c
    .from("experiment_hypotheses")
    .select("experiment_id, hypothesis_id")
    .in("experiment_id", rows.map((r) => r.id));
  if (error) throw error;
  const byExp: Record<string, string[]> = {};
  for (const link of (links ?? []) as Array<{ experiment_id: string; hypothesis_id: string }>) {
    (byExp[link.experiment_id] ??= []).push(link.hypothesis_id);
  }
  return rows.map((r) => ({ ...r, hypothesis_ids: byExp[r.id] ?? [] }));
}

async function getExperiments(c: ScopedClient, p: Params) {
  if (p.id) return getExperimentDetail(c, p);
  let q = c.from("experiments").select("*").order("updated_at", { ascending: false });
  if (p.status) q = q.eq("status", p.status);
  if (p.project_id) q = q.eq("project_id", p.project_id);
  if (p.limit !== undefined) q = q.limit(Number(p.limit));
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string }>;
  if (rows.length === 0) return { experiments: [] };

  const [enriched, logsRes] = await Promise.all([
    enrichExperimentsWithHypothesisIds(c, rows),
    c.from("experiment_logs")
      .select("*")
      .in("experiment_id", rows.map((r) => r.id))
      .order("logged_at", { ascending: false }),
  ]);
  if (logsRes.error) throw logsRes.error;

  const latestByExp: Record<string, unknown> = {};
  for (const log of (logsRes.data ?? []) as Array<{ experiment_id: string }>) {
    if (!latestByExp[log.experiment_id]) latestByExp[log.experiment_id] = log;
  }

  return {
    experiments: enriched.map((e) => ({
      ...e,
      latest_log: latestByExp[e.id] ?? null,
    })),
  };
}

async function getExperimentDetail(c: ScopedClient, p: Params) {
  const id = String(p.id);
  const { data: experiment, error: expErr } = await c
    .from("experiments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (expErr) throw expErr;
  if (!experiment) {
    throw new NotFoundError(`Experiment with id "${id}" not found.`);
  }
  const [enriched, logsRes] = await Promise.all([
    enrichExperimentsWithHypothesisIds(c, [experiment as { id: string }]),
    c.from("experiment_logs")
      .select("*")
      .eq("experiment_id", id)
      .order("logged_at", { ascending: true }),
  ]);
  if (logsRes.error) throw logsRes.error;
  return { experiment: enriched[0], logs: logsRes.data ?? [] };
}

async function queryWorkByTicket(c: ScopedClient, p: Params) {
  const identifier = String(p.ticket_identifier);
  const { data: ticket, error: tErr } = await c
    .from("linear_tickets")
    .select("*")
    .eq("identifier", identifier)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!ticket) {
    throw new NotFoundError(
      `Linear ticket "${identifier}" is not cached. Link a task to it first.`,
    );
  }

  const { data: tasks, error: taskErr } = await c
    .from("tasks")
    .select("id, title, status")
    .eq("linear_ticket_id", ticket.id);
  if (taskErr) throw taskErr;
  const taskRows = (tasks ?? []) as Array<{ id: string; title: string; status: string }>;

  let sessions: Array<{
    session_id: string;
    started_at: string;
    duration_minutes: number | null;
    source: string;
  }> = [];
  let total_minutes = 0;

  if (taskRows.length > 0) {
    const taskIds = taskRows.map((t) => t.id);
    let q = c
      .from("session_tasks")
      .select(
        "task_id, focus_sessions!inner(id, started_at, ended_at, duration_minutes, source)",
      )
      .in("task_id", taskIds);
    if (p.since) q = q.gte("focus_sessions.started_at", String(p.since));
    if (p.until) q = q.lte("focus_sessions.started_at", String(p.until));

    const { data: sessionRows, error: sessErr } = await q;
    if (sessErr) throw sessErr;

    type SessionLink = {
      task_id: string;
      focus_sessions: {
        id: string;
        started_at: string;
        ended_at: string | null;
        duration_minutes: number | null;
        source: string;
      };
    };

    const seen = new Set<string>();
    for (const row of (sessionRows ?? []) as unknown as SessionLink[]) {
      const fs = row.focus_sessions;
      if (!fs || seen.has(fs.id)) continue;
      seen.add(fs.id);
      sessions.push({
        session_id: fs.id,
        started_at: fs.started_at,
        duration_minutes: fs.duration_minutes,
        source: fs.source,
      });
      if (fs.duration_minutes) total_minutes += fs.duration_minutes;
    }
    sessions = sessions.sort((a, b) => a.started_at.localeCompare(b.started_at));
  }

  return {
    ticket: {
      identifier: ticket.identifier,
      title: ticket.title,
      status: ticket.status,
      url: ticket.url,
    },
    tasks: taskRows.map((t) => ({ task_id: t.id, title: t.title, status: t.status })),
    sessions,
    total_minutes,
    session_count: sessions.length,
  };
}

async function listLinearTickets(c: ScopedClient, p: Params) {
  let q = c.from("linear_tickets").select("*").order("identifier", { ascending: true });
  if (p.team_key) q = q.eq("team_key", String(p.team_key).toUpperCase());
  if (p.status) q = q.eq("status", String(p.status));
  if (p.limit !== undefined) q = q.limit(Number(p.limit));
  const { data, error } = await q;
  if (error) throw error;
  return {
    tickets: (data ?? []).map(
      (t: {
        identifier: string;
        title: string | null;
        status: string | null;
        url: string | null;
        team_key: string;
      }) => ({
        identifier: t.identifier,
        title: t.title,
        status: t.status,
        url: t.url,
        team_key: t.team_key,
      }),
    ),
  };
}

async function listProjects(c: ScopedClient, p: Params) {
  const status = (p.status as string | undefined) ?? "active";
  let q = c
    .from("projects")
    .select("id, name, description, status")
    .order("created_at", { ascending: true });
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return { projects: data ?? [] };
}

// Enumerate everything read_skill can load: the built-in example skills
// bundled at build time plus the user's own skills (overrides + custom). A
// user_skills row whose name matches a built-in shadows it in read_skill, so
// is_override is surfaced here to make that relationship visible.
async function listSkills(c: ScopedClient, _p: Params) {
  const { data, error } = await c
    .from("user_skills")
    .select("skill_name, is_override")
    .order("skill_name", { ascending: true });
  if (error) throw error;
  const userSkills = (data ?? []) as Array<{ skill_name: string; is_override: boolean }>;
  return {
    built_in_skills: Object.keys(SKILLS).sort(),
    user_skills: userSkills.map((s) => ({
      skill_name: s.skill_name,
      is_override: s.is_override,
    })),
  };
}

async function readSkill(c: ScopedClient, p: Params) {
  const name = String(p.skill_name ?? "").trim();
  if (!name) {
    throw new ValidationError("skill_name is required.");
  }

  const { data: userSkill, error } = await c
    .from("user_skills")
    .select("content")
    .eq("skill_name", name)
    .maybeSingle();
  if (error) throw error;

  if (userSkill) {
    return { skill_name: name, content: userSkill.content };
  }

  const content = SKILLS[name];
  if (content === undefined) {
    const builtIn = Object.keys(SKILLS).sort();
    const { data: custom } = await c
      .from("user_skills")
      .select("skill_name");
    const customNames = (custom ?? [])
      .map((r: { skill_name: string }) => r.skill_name)
      .sort();
    const all = [...new Set([...builtIn, ...customNames])].sort().join(", ");
    throw new NotFoundError(
      `Skill "${name}" not found. Available: ${all}.`,
    );
  }
  return { skill_name: name, content };
}

export const READ_HANDLERS: Record<
  string,
  (c: ScopedClient, p: Params) => Promise<unknown>
> = {
  [`${MCP_TOOL_PREFIX}get_goals`]: getGoals,
  [`${MCP_TOOL_PREFIX}get_tasks`]: getTasks,
  [`${MCP_TOOL_PREFIX}list_journal_entries`]: listJournalEntries,
  [`${MCP_TOOL_PREFIX}get_decisions`]: getDecisions,
  [`${MCP_TOOL_PREFIX}get_hypotheses`]: getHypotheses,
  [`${MCP_TOOL_PREFIX}get_experiments`]: getExperiments,
  [`${MCP_TOOL_PREFIX}query_work_by_ticket`]: queryWorkByTicket,
  [`${MCP_TOOL_PREFIX}list_linear_tickets`]: listLinearTickets,
  [`${MCP_TOOL_PREFIX}list_projects`]: listProjects,
  [`${MCP_TOOL_PREFIX}list_skills`]: listSkills,
  [`${MCP_TOOL_PREFIX}read_skill`]: readSkill,
};
