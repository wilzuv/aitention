// src/services/moodService.ts
import { SupabaseClient } from "@supabase/supabase-js";
import type { MoodLog, MoodContext } from "@/types/daily";

/** Return the date string for the day after the given YYYY-MM-DD date */
function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

/** Returns local midnight as a timezone-aware ISO string (e.g. "2026-04-07T00:00:00+10:00") */
function localMidnight(date: string): string {
  const offset = -(new Date(`${date}T00:00:00`).getTimezoneOffset());
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${date}T00:00:00${sign}${hh}:${mm}`;
}

// ── Parsing ──

export function parseMoodLog(row: Record<string, unknown>): MoodLog {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    logged_at: row.logged_at as string,
    mood_rating: row.mood_rating as number | null,
    energy_rating: row.energy_rating as number | null,
    note: row.note as string | null,
    context: row.context as MoodContext,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ── Read ──

export async function fetchMoodLogs(
  supabase: SupabaseClient,
  date: string
): Promise<MoodLog[]> {
  const { data, error } = await supabase
    .from("mood_logs")
    .select("*")
    .gte("logged_at", localMidnight(date))
    .lt("logged_at", localMidnight(nextDay(date)))
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(parseMoodLog);
}

export async function fetchMoodLogsRange(
  supabase: SupabaseClient,
  dateFrom: string,
  dateTo: string
): Promise<MoodLog[]> {
  const { data, error } = await supabase
    .from("mood_logs")
    .select("*")
    .gte("logged_at", localMidnight(dateFrom))
    .lt("logged_at", localMidnight(nextDay(dateTo)))
    .order("logged_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(parseMoodLog);
}

// ── Validation ──

/**
 * Decision #8: Validate valence/arousal (mood_rating/energy_rating) at the
 * service layer before hitting the DB. Valid range is 1–7 per the circumplex
 * model. Null is allowed (logging is optional).
 */
function validateMoodValues(moodRating?: number | null, energyRating?: number | null): void {
  if (moodRating != null && (moodRating < 1 || moodRating > 7 || !Number.isInteger(moodRating))) {
    throw new Error(`mood_rating must be an integer between 1 and 7, got ${moodRating}`);
  }
  if (energyRating != null && (energyRating < 1 || energyRating > 7 || !Number.isInteger(energyRating))) {
    throw new Error(`energy_rating must be an integer between 1 and 7, got ${energyRating}`);
  }
}

// ── Write ──

export async function logMood(
  supabase: SupabaseClient,
  input: {
    mood_rating?: number;
    energy_rating?: number;
    note?: string;
    context: MoodContext;
  }
): Promise<MoodLog> {
  validateMoodValues(input.mood_rating, input.energy_rating);
  const { data, error } = await supabase
    .from("mood_logs")
    .insert({
      mood_rating: input.mood_rating ?? null,
      energy_rating: input.energy_rating ?? null,
      note: input.note ?? null,
      context: input.context,
    })
    .select()
    .single();
  if (error) throw error;
  return parseMoodLog(data as Record<string, unknown>);
}

export async function updateMood(
  supabase: SupabaseClient,
  input: {
    id: string;
    mood_rating?: number | null;
    energy_rating?: number | null;
    note?: string | null;
  }
): Promise<MoodLog> {
  validateMoodValues(input.mood_rating, input.energy_rating);
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if ("mood_rating" in input) payload.mood_rating = input.mood_rating ?? null;
  if ("energy_rating" in input) payload.energy_rating = input.energy_rating ?? null;
  if ("note" in input) payload.note = input.note ?? null;

  const { data, error } = await supabase
    .from("mood_logs")
    .update(payload)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return parseMoodLog(data as Record<string, unknown>);
}

export async function deleteMood(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("mood_logs").delete().eq("id", id);
  if (error) throw error;
}

