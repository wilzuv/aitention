// src/services/settingsService.ts
import { SupabaseClient } from "@supabase/supabase-js";
import type { Json, TablesInsert } from "@/integrations/supabase/types";

// ── App settings ──

export async function fetchSetting<T extends Json = Json>(
  supabase: SupabaseClient,
  key: string
): Promise<T | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("setting_key", key)
    .maybeSingle();
  if (error) throw error;
  return (data?.setting_value as T | null) ?? null;
}

export async function upsertSetting<T extends Json = Json>(
  supabase: SupabaseClient,
  key: string,
  value: T
): Promise<void> {
  const payload: TablesInsert<"app_settings"> = {
    setting_key: key,
    setting_value: value,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("app_settings")
    .upsert(payload, { onConflict: "setting_key,user_id" });
  if (error) throw error;
}

// ── Oura integration ──

export async function fetchOuraIntegration(
  supabase: SupabaseClient
): Promise<{ connected_at: string } | null> {
  const { data } = await supabase
    .from("user_integrations")
    .select("connected_at")
    .eq("provider", "oura")
    .maybeSingle();
  return data as { connected_at: string } | null;
}

export async function disconnectOura(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("provider", "oura");
  if (error) throw error;
}
