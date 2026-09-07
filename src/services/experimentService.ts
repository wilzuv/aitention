// src/services/experimentService.ts

import { SupabaseClient } from "@supabase/supabase-js";

export type ExperimentStatus = "running" | "concluded" | "abandoned";

export interface Experiment {
  id: string;
  user_id: string;
  project_id: string | null;
  hypothesis_ids: string[];
  title: string;
  protocol: string;
  success_criteria: string | null;
  status: ExperimentStatus;
  start_date: string;
  end_date: string | null;
  conclusion: string | null;
  concluded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExperimentLog {
  id: string;
  user_id: string;
  experiment_id: string;
  note: string;
  logged_at: string;
  created_at: string;
}

// ── Read ──

export interface FetchExperimentsOptions {
  status?: ExperimentStatus;
  hypothesis_id?: string;
  limit?: number;
}

async function enrichWithHypothesisIds(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
): Promise<Experiment[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id as string);
  const { data: links, error } = await supabase
    .from("experiment_hypotheses")
    .select("experiment_id, hypothesis_id")
    .in("experiment_id", ids);
  if (error) throw error;
  const byExp: Record<string, string[]> = {};
  for (const link of links ?? []) {
    (byExp[link.experiment_id] ??= []).push(link.hypothesis_id);
  }
  return rows.map((r) => ({
    ...r,
    hypothesis_ids: byExp[r.id as string] ?? [],
  })) as Experiment[];
}


export async function fetchExperiments(
  supabase: SupabaseClient,
  opts: FetchExperimentsOptions = {},
): Promise<Experiment[]> {
  if (opts.hypothesis_id) {
    const { data: links, error: linkErr } = await supabase
      .from("experiment_hypotheses")
      .select("experiment_id")
      .eq("hypothesis_id", opts.hypothesis_id);
    if (linkErr) throw linkErr;
    const expIds = (links ?? []).map((l) => l.experiment_id);
    if (expIds.length === 0) return [];
    let q = supabase
      .from("experiments")
      .select("*")
      .in("id", expIds)
      .order("updated_at", { ascending: false });
    if (opts.status) q = q.eq("status", opts.status);
    if (opts.limit !== undefined) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw error;
    return enrichWithHypothesisIds(supabase, data ?? []);
  }

  let q = supabase
    .from("experiments")
    .select("*")
    .order("updated_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.limit !== undefined) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return enrichWithHypothesisIds(supabase, data ?? []);
}

export async function fetchExperimentById(
  supabase: SupabaseClient,
  id: string,
): Promise<Experiment | null> {
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const enriched = await enrichWithHypothesisIds(supabase, [data]);
  return enriched[0];
}

export async function fetchLogsForExperiment(
  supabase: SupabaseClient,
  experimentId: string,
): Promise<ExperimentLog[]> {
  const { data, error } = await supabase
    .from("experiment_logs")
    .select("*")
    .eq("experiment_id", experimentId)
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ExperimentLog[];
}

/** Experiments linked to any of the supplied hypothesis ids. */
export async function fetchExperimentsForHypotheses(
  supabase: SupabaseClient,
  hypothesisIds: string[],
): Promise<Experiment[]> {
  if (hypothesisIds.length === 0) return [];
  const { data: links, error: linkErr } = await supabase
    .from("experiment_hypotheses")
    .select("experiment_id")
    .in("hypothesis_id", hypothesisIds);
  if (linkErr) throw linkErr;
  const expIds = [...new Set((links ?? []).map((l) => l.experiment_id))];
  if (expIds.length === 0) return [];
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .in("id", expIds)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return enrichWithHypothesisIds(supabase, data ?? []);
}

/**
 * Latest log per experiment in the supplied set. Used to enrich the
 * `aitention://experiments/running` resource so a client can see at a glance
 * whether today's check-in is missing for each running experiment.
 */
export async function fetchLatestLogPerExperiment(
  supabase: SupabaseClient,
  experimentIds: string[],
): Promise<Record<string, ExperimentLog | undefined>> {
  if (experimentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("experiment_logs")
    .select("*")
    .in("experiment_id", experimentIds)
    .order("logged_at", { ascending: false });
  if (error) throw error;
  const out: Record<string, ExperimentLog | undefined> = {};
  for (const row of (data ?? []) as ExperimentLog[]) {
    if (!out[row.experiment_id]) out[row.experiment_id] = row;
  }
  return out;
}

// ── Write ──

export interface CreateExperimentInput {
  title: string;
  protocol: string;
  start_date: string;
  end_date?: string | null;
  success_criteria?: string | null;
  hypothesis_ids?: string[];
}

export async function createExperiment(
  supabase: SupabaseClient,
  input: CreateExperimentInput,
): Promise<Experiment> {
  const { data, error } = await supabase
    .from("experiments")
    .insert({
      title: input.title,
      protocol: input.protocol,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      success_criteria: input.success_criteria ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  const ids = input.hypothesis_ids ?? [];
  if (ids.length > 0) {
    const { error: linkErr } = await supabase
      .from("experiment_hypotheses")
      .insert(ids.map((hid) => ({ experiment_id: data.id, hypothesis_id: hid })));
    if (linkErr) throw linkErr;
  }

  return { ...data, hypothesis_ids: ids } as Experiment;
}

export interface UpdateExperimentPatch {
  title?: string;
  protocol?: string;
  success_criteria?: string | null;
  hypothesis_ids?: string[];
  start_date?: string;
  status?: ExperimentStatus;
  conclusion?: string | null;
  concluded_at?: string | null;
  end_date?: string | null;
}

export async function updateExperiment(
  supabase: SupabaseClient,
  id: string,
  patch: UpdateExperimentPatch,
): Promise<Experiment> {
  const { hypothesis_ids, ...rest } = patch;
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) row[k] = v;
  }
  const { data, error } = await supabase
    .from("experiments")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  if (hypothesis_ids !== undefined) {
    await supabase
      .from("experiment_hypotheses")
      .delete()
      .eq("experiment_id", id);
    if (hypothesis_ids.length > 0) {
      const { error: linkErr } = await supabase
        .from("experiment_hypotheses")
        .insert(
          hypothesis_ids.map((hid) => ({ experiment_id: id, hypothesis_id: hid })),
        );
      if (linkErr) throw linkErr;
    }
  }

  const enriched = await enrichWithHypothesisIds(supabase, [data]);
  return enriched[0];
}

export async function insertExperimentLog(
  supabase: SupabaseClient,
  input: {
    experiment_id: string;
    note: string;
    logged_at?: string;
  },
): Promise<ExperimentLog> {
  const { data, error } = await supabase
    .from("experiment_logs")
    .insert({
      experiment_id: input.experiment_id,
      note: input.note,
      logged_at: input.logged_at ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as ExperimentLog;
}

/** Hard-delete an experiment. Its experiment_logs and hypothesis links cascade. */
export async function deleteExperiment(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("experiments").delete().eq("id", id);
  if (error) throw error;
}
