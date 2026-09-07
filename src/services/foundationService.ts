import { SupabaseClient } from "@supabase/supabase-js";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ── Types ──

export type Foundation = Tables<"foundations">;
export type FoundationInsert = TablesInsert<"foundations">;
export type FoundationUpdate = TablesUpdate<"foundations">;

export interface CreateFoundationInput {
  title: string;
  description?: string;
}

// ── Reads ──

export async function fetchFoundations(
  supabase: SupabaseClient
): Promise<Foundation[]> {
  const { data, error } = await supabase
    .from("foundations")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Foundation[];
}

// ── Writes ──

export async function createFoundation(
  supabase: SupabaseClient,
  input: CreateFoundationInput
): Promise<Foundation> {
  const payload: FoundationInsert = {
    title: input.title,
    description: input.description ?? null,
  };

  const { data, error } = await supabase
    .from("foundations")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  return data as Foundation;
}

export async function updateFoundation(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<{ title: string; description: string | null }>
): Promise<void> {
  const patch: FoundationUpdate = {
    updated_at: new Date().toISOString(),
  };
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.description !== undefined) patch.description = updates.description;

  const { error } = await supabase.from("foundations").update(patch).eq("id", id);
  if (error) throw error;
}

// Deleting a foundation orphans its goals (goals.foundation_id is SET NULL by
// the FK), so the goals themselves are preserved.
export async function deleteFoundation(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("foundations").delete().eq("id", id);
  if (error) throw error;
}
