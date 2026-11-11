// MCP resources — URI-addressable read-only context an MCP client (e.g.
// Claude Desktop) can pull into its window without a tool round-trip.
//
// Phase 1 ships four pure-snapshot resources. They reuse the same direct
// table reads as the Phase-1 tools.

import type { ScopedClient } from "./scopedClient.ts";

export interface ResourceDef {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const RESOURCES: ResourceDef[] = [
  {
    uri: "aitention://today",
    name: "Today",
    description:
      "Today's daily entry, today's tasks, and today's mood logs in one snapshot.",
    mimeType: "application/json",
  },
  {
    uri: "aitention://this-week",
    name: "This week",
    description:
      "Week-to-date snapshot from this week's Monday through today: tasks, focus sessions, daily entries, mood logs.",
    mimeType: "application/json",
  },
  {
    uri: "aitention://active-goals",
    name: "Open goals",
    description:
      "All open goals (status IS NULL) ordered by review_date.",
    mimeType: "application/json",
  },
  {
    uri: "aitention://decisions/open",
    name: "Open decisions",
    description:
      "Decisions with status='open' — the deliberations the user is currently weighing. Most recently updated first.",
    mimeType: "application/json",
  },
  {
    uri: "aitention://decisions/awaiting-review",
    name: "Decisions awaiting review",
    description:
      "Decisions that are decided and whose review_date has arrived (or passed) without being reviewed. The keystone resource for closing the calibration loop on past decisions.",
    mimeType: "application/json",
  },
  {
    uri: "aitention://experiments/running",
    name: "Running experiments",
    description:
      "Experiments with status='running' plus today's log per experiment (or null when today is still unlogged). Lets a client see at a glance which experiments are awaiting today's check-in.",
    mimeType: "application/json",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function mondayOfWeek(d: Date): string {
  const day = d.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

// ── Read implementations ──────────────────────────────────────────────────

async function readToday(c: ScopedClient) {
  const date = todayIso();
  const [tasks, mood] = await Promise.all([
    c.from("tasks").select("*").or(`scheduled_date.eq.${date},due_date.eq.${date}`),
    c.from("mood_logs").select("*").gte("logged_at", `${date}T00:00:00`)
      .lt("logged_at", `${date}T23:59:59`),
  ]);
  return {
    date,
    tasks: tasks.data ?? [],
    mood_logs: mood.data ?? [],
  };
}

async function readThisWeek(c: ScopedClient) {
  const today = todayIso();
  const start = mondayOfWeek(new Date());
  const [tasks, focus, mood] = await Promise.all([
    c.from("tasks").select("*")
      .or(`scheduled_date.gte.${start},due_date.gte.${start}`)
      .or(`scheduled_date.lte.${today},due_date.lte.${today}`),
    c.from("focus_sessions").select("*")
      .gte("start_time", `${start}T00:00:00`)
      .lte("start_time", `${today}T23:59:59`),
    c.from("mood_logs").select("*")
      .gte("logged_at", `${start}T00:00:00`)
      .lte("logged_at", `${today}T23:59:59`),
  ]);
  return {
    week_start: start,
    today,
    tasks: tasks.data ?? [],
    focus_sessions: focus.data ?? [],
    mood_logs: mood.data ?? [],
  };
}

async function readActiveGoals(c: ScopedClient) {
  const { data, error } = await c.from("goals").select("*").is("status", null)
    .order("review_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return { goals: data ?? [] };
}

async function readOpenDecisions(c: ScopedClient) {
  const { data, error } = await c.from("decisions").select("*")
    .eq("status", "open")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return { decisions: data ?? [] };
}

async function readDecisionsAwaitingReview(c: ScopedClient) {
  const today = todayIso();
  const { data, error } = await c.from("decisions").select("*")
    .eq("status", "decided")
    .is("reviewed_at", null)
    .not("review_date", "is", null)
    .lte("review_date", today)
    .order("review_date", { ascending: true });
  if (error) throw error;
  return { today, decisions: data ?? [] };
}

async function readRunningExperiments(c: ScopedClient) {
  const today = todayIso();
  const { data: experiments, error } = await c.from("experiments").select("*")
    .eq("status", "running")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = (experiments ?? []) as Array<{ id: string }>;
  if (rows.length === 0) return { today, experiments: [] };

  const [linksRes, logsRes] = await Promise.all([
    c.from("experiment_hypotheses")
      .select("experiment_id, hypothesis_id")
      .in("experiment_id", rows.map((r) => r.id)),
    c.from("experiment_logs").select("*")
      .in("experiment_id", rows.map((r) => r.id))
      .gte("logged_at", `${today}T00:00:00`)
      .lt("logged_at", `${today}T23:59:59.999`),
  ]);
  if (linksRes.error) throw linksRes.error;
  if (logsRes.error) throw logsRes.error;

  const hyposByExp: Record<string, string[]> = {};
  for (const link of (linksRes.data ?? []) as Array<{ experiment_id: string; hypothesis_id: string }>) {
    (hyposByExp[link.experiment_id] ??= []).push(link.hypothesis_id);
  }

  const todayLogByExp: Record<string, unknown> = {};
  for (const log of (logsRes.data ?? []) as Array<{ experiment_id: string }>) {
    todayLogByExp[log.experiment_id] = log;
  }

  const enriched = rows.map((e) => ({
    ...e,
    hypothesis_ids: hyposByExp[e.id] ?? [],
    today_log: todayLogByExp[e.id] ?? null,
  }));
  return { today, experiments: enriched };
}

const READERS: Record<string, (c: ScopedClient) => Promise<unknown>> = {
  "aitention://today": readToday,
  "aitention://this-week": readThisWeek,
  "aitention://active-goals": readActiveGoals,
  "aitention://decisions/open": readOpenDecisions,
  "aitention://decisions/awaiting-review": readDecisionsAwaitingReview,
  "aitention://experiments/running": readRunningExperiments,
};

export async function readResource(
  client: ScopedClient,
  uri: string
): Promise<
  { uri: string; mimeType: string; text: string; _meta?: Record<string, unknown> } | null
> {
  const reader = READERS[uri];
  if (!reader) return null;
  const payload = await reader(client);
  return { uri, mimeType: "application/json", text: JSON.stringify(payload) };
}
