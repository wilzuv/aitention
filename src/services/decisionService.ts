// src/services/decisionService.ts
//
// Decisions are durable, multi-day deliberations. The row holds the final
// commit (chosen_option + rationale + review_date); the running thinking lives
// in append-only decision_notes rows. See
// docs/superpowers/specs/rationality-layer/design.md for the full shape.

import { SupabaseClient } from "@supabase/supabase-js";

export type DecisionStatus = "open" | "decided" | "abandoned";
export type DecisionReviewOutcome =
  | "good_call"
  | "wrong_call"
  | "partial"
  | "inconclusive";

export interface DecisionOption {
  name: string;
  notes?: string;
}

export interface Decision {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  context: string;
  options: DecisionOption[];
  status: DecisionStatus;
  chosen_option: string | null;
  rationale: string | null;
  decided_at: string | null;
  review_date: string | null;
  reviewed_at: string | null;
  review_outcome: DecisionReviewOutcome | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DecisionNote {
  id: string;
  user_id: string;
  decision_id: string;
  note: string;
  created_at: string;
}

// ── Read ──

export interface FetchDecisionsOptions {
  status?: DecisionStatus;
  limit?: number;
}

export async function fetchDecisions(
  supabase: SupabaseClient,
  opts: FetchDecisionsOptions = {},
): Promise<Decision[]> {
  let q = supabase
    .from("decisions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.limit !== undefined) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Decision[];
}

export async function fetchDecisionById(
  supabase: SupabaseClient,
  id: string,
): Promise<Decision | null> {
  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Decision | null;
}

export async function fetchNotesForDecision(
  supabase: SupabaseClient,
  decisionId: string,
): Promise<DecisionNote[]> {
  const { data, error } = await supabase
    .from("decision_notes")
    .select("*")
    .eq("decision_id", decisionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DecisionNote[];
}

// ── Write ──

export interface CreateDecisionInput {
  title: string;
  context: string;
  options?: DecisionOption[];
  review_date?: string | null;
}

export async function createDecision(
  supabase: SupabaseClient,
  input: CreateDecisionInput,
): Promise<Decision> {
  const { data, error } = await supabase
    .from("decisions")
    .insert({
      title: input.title,
      context: input.context,
      options: input.options ?? [],
      review_date: input.review_date ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Decision;
}

export interface UpdateDecisionPatch {
  title?: string;
  context?: string;
  options?: DecisionOption[];
  status?: DecisionStatus;
  chosen_option?: string | null;
  rationale?: string | null;
  decided_at?: string | null;
  review_date?: string | null;
  reviewed_at?: string | null;
  review_outcome?: DecisionReviewOutcome | null;
  review_notes?: string | null;
}

export async function updateDecision(
  supabase: SupabaseClient,
  id: string,
  patch: UpdateDecisionPatch,
): Promise<Decision> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) row[k] = v;
  }
  const { data, error } = await supabase
    .from("decisions")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Decision;
}

/**
 * Append a note to a decision and bump the parent's updated_at so the
 * decision rises to the top of an "open decisions" list. Two writes, no
 * transaction — RLS gives us per-row isolation and the worst case is a
 * note exists without the bump (still readable; sort order is the only
 * casualty).
 */
export async function appendDecisionNote(
  supabase: SupabaseClient,
  decisionId: string,
  note: string,
): Promise<DecisionNote> {
  const { data, error } = await supabase
    .from("decision_notes")
    .insert({ decision_id: decisionId, note })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("decisions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", decisionId);

  return data as DecisionNote;
}

/**
 * Hard-delete a decision. The append-only decision_notes rows cascade
 * (ON DELETE CASCADE); linked hypotheses are unlinked (ON DELETE SET NULL).
 */
export async function deleteDecision(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("decisions").delete().eq("id", id);
  if (error) throw error;
}
