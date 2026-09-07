import { SupabaseClient } from "@supabase/supabase-js";

export interface Hypothesis {
  id: string;
  user_id: string;
  project_id: string | null;
  decision_id: string | null;
  statement: string;
  current_credence: number;
  basis: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HypothesisEvidence {
  id: string;
  user_id: string;
  hypothesis_id: string;
  note: string;
  prior_credence: number | null;
  posterior_credence: number | null;
  created_at: string;
}

// ── Read ──

export interface FetchHypothesesOptions {
  decision_id?: string;
  archived?: boolean;
  search?: string;
  limit?: number;
}

export async function fetchHypotheses(
  supabase: SupabaseClient,
  opts: FetchHypothesesOptions = {},
): Promise<Hypothesis[]> {
  let q = supabase
    .from("hypotheses")
    .select("*")
    .order("updated_at", { ascending: false });
  if (opts.decision_id) q = q.eq("decision_id", opts.decision_id);
  if (opts.archived === true) q = q.not("archived_at", "is", null);
  else if (opts.archived === false || opts.archived === undefined)
    q = q.is("archived_at", null);
  if (opts.search) q = q.ilike("statement", `%${opts.search}%`);
  if (opts.limit !== undefined) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Hypothesis[];
}

export async function fetchHypothesisById(
  supabase: SupabaseClient,
  id: string,
): Promise<Hypothesis | null> {
  const { data, error } = await supabase
    .from("hypotheses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Hypothesis | null;
}

export async function fetchEvidenceForHypothesis(
  supabase: SupabaseClient,
  hypothesisId: string,
): Promise<HypothesisEvidence[]> {
  const { data, error } = await supabase
    .from("hypothesis_evidence")
    .select("*")
    .eq("hypothesis_id", hypothesisId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HypothesisEvidence[];
}

export async function fetchEvidenceForHypotheses(
  supabase: SupabaseClient,
  hypothesisIds: string[],
): Promise<Record<string, HypothesisEvidence[]>> {
  const out: Record<string, HypothesisEvidence[]> = {};
  if (hypothesisIds.length === 0) return out;
  const { data, error } = await supabase
    .from("hypothesis_evidence")
    .select("*")
    .in("hypothesis_id", hypothesisIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  for (const row of (data ?? []) as HypothesisEvidence[]) {
    (out[row.hypothesis_id] ??= []).push(row);
  }
  return out;
}

// ── Write ──

export interface CreateHypothesisInput {
  statement: string;
  current_credence: number;
  basis?: string | null;
  decision_id?: string | null;
}

export async function createHypothesis(
  supabase: SupabaseClient,
  input: CreateHypothesisInput,
): Promise<Hypothesis> {
  const { data, error } = await supabase
    .from("hypotheses")
    .insert({
      statement: input.statement,
      current_credence: input.current_credence,
      basis: input.basis ?? null,
      decision_id: input.decision_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Hypothesis;
}

export interface UpdateHypothesisPatch {
  statement?: string;
  current_credence?: number;
  basis?: string | null;
  archived?: boolean;
}

export async function updateHypothesis(
  supabase: SupabaseClient,
  id: string,
  patch: UpdateHypothesisPatch,
): Promise<Hypothesis> {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { updated_at: now };
  if (patch.statement !== undefined) row.statement = patch.statement;
  if (patch.current_credence !== undefined) row.current_credence = patch.current_credence;
  if (patch.basis !== undefined) row.basis = patch.basis;
  if (patch.archived === true) row.archived_at = now;
  else if (patch.archived === false) row.archived_at = null;
  const { data, error } = await supabase
    .from("hypotheses")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Hypothesis;
}

/**
 * Append evidence with a credence update. Auto-reads current_credence as
 * prior_credence, inserts the evidence row, then syncs the hypothesis's
 * current_credence to posterior_credence.
 */
export async function appendHypothesisEvidence(
  supabase: SupabaseClient,
  input: {
    hypothesis_id: string;
    note: string;
    posterior_credence: number;
  },
): Promise<HypothesisEvidence> {
  const { data: hypothesis, error: fetchErr } = await supabase
    .from("hypotheses")
    .select("current_credence")
    .eq("id", input.hypothesis_id)
    .single();
  if (fetchErr) throw fetchErr;

  const priorCredence = (hypothesis as { current_credence: number })
    .current_credence;

  const { data, error } = await supabase
    .from("hypothesis_evidence")
    .insert({
      hypothesis_id: input.hypothesis_id,
      note: input.note,
      prior_credence: priorCredence,
      posterior_credence: input.posterior_credence,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("hypotheses")
    .update({
      current_credence: input.posterior_credence,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.hypothesis_id);

  return data as HypothesisEvidence;
}

export async function deleteHypothesis(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("hypotheses").delete().eq("id", id);
  if (error) throw error;
}
