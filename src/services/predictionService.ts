// src/services/predictionService.ts
//
// Predictions are first-class calibration rows across daily / weekly / adhoc
// scopes, sourced from either the user or the agent. Content fields become
// immutable once `outcome` is set (enforced by trigger).

import { SupabaseClient } from "@supabase/supabase-js";

export type PredictionSource = "user" | "agent";
export type PredictionOutcome = "hit" | "miss" | "unresolvable";

export interface Prediction {
  id: string;
  user_id: string;
  project_id: string | null;
  hypothesis_id: string | null;
  prediction: string;
  confidence: number;
  reasoning: string | null;
  source: PredictionSource;
  resolution_date: string;
  outcome: PredictionOutcome | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Read ──

export interface FetchPredictionsOptions {
  source?: PredictionSource;
  outcome?: PredictionOutcome | "unresolved";
  limit?: number;
}

export async function fetchPredictions(
  supabase: SupabaseClient,
  opts: FetchPredictionsOptions = {},
): Promise<Prediction[]> {
  let q = supabase
    .from("predictions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (opts.source) q = q.eq("source", opts.source);
  if (opts.outcome === "unresolved") {
    q = q.is("outcome", null);
  } else if (opts.outcome) {
    q = q.eq("outcome", opts.outcome);
  }
  if (opts.limit !== undefined) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Prediction[];
}

export async function fetchPredictionById(
  supabase: SupabaseClient,
  id: string,
): Promise<Prediction | null> {
  const { data, error } = await supabase
    .from("predictions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Prediction | null;
}

// ── Write ──

export interface CreatePredictionInput {
  prediction: string;
  confidence: number;
  resolution_date: string;
  reasoning?: string | null;
  source?: PredictionSource;
  project_id?: string | null;
  hypothesis_id?: string | null;
}

export async function createPrediction(
  supabase: SupabaseClient,
  input: CreatePredictionInput,
): Promise<Prediction> {
  const { data, error } = await supabase
    .from("predictions")
    .insert({
      prediction: input.prediction,
      confidence: input.confidence,
      resolution_date: input.resolution_date,
      reasoning: input.reasoning ?? null,
      source: input.source ?? "user",
      project_id: input.project_id ?? null,
      hypothesis_id: input.hypothesis_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Prediction;
}

/**
 * Patch a prediction. Content fields (prediction, confidence, reasoning) are
 * immutable once an outcome is set — the DB trigger enforces this, so callers
 * should only edit content while the prediction is still open. Setting
 * `outcome` resolves it (the trigger stamps resolved_at automatically).
 */
export interface UpdatePredictionPatch {
  prediction?: string;
  confidence?: number;
  reasoning?: string | null;
  resolution_date?: string;
  outcome?: PredictionOutcome | null;
  resolution?: string | null;
  project_id?: string | null;
  hypothesis_id?: string | null;
}

export async function updatePrediction(
  supabase: SupabaseClient,
  id: string,
  patch: UpdatePredictionPatch,
): Promise<Prediction> {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) row[k] = v;
  }
  const { data, error } = await supabase
    .from("predictions")
    .update(row)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Prediction;
}

export async function deletePrediction(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("predictions").delete().eq("id", id);
  if (error) throw error;
}
