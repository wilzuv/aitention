// src/services/journalService.ts
import { SupabaseClient } from "@supabase/supabase-js";
import type { JournalEntry } from "@/types/daily";

// ── Parsing ──

export function parseJournalEntry(row: Record<string, unknown>): JournalEntry {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    entry_date: row.entry_date as string,
    content: row.content as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ── Read ──

export async function fetchJournalEntries(
  supabase: SupabaseClient,
  date: string
): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("entry_date", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(parseJournalEntry);
}

export async function fetchJournalEntriesRange(
  supabase: SupabaseClient,
  dateFrom: string,
  dateTo: string
): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .gte("entry_date", dateFrom)
    .lte("entry_date", dateTo)
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(parseJournalEntry);
}

// ── Write ──

export async function addFreeEntry(
  supabase: SupabaseClient,
  date: string,
  content: string
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      entry_date: date,
      content,
    })
    .select()
    .single();
  if (error) throw error;
  return parseJournalEntry(data as Record<string, unknown>);
}

export async function updateEntry(
  supabase: SupabaseClient,
  id: string,
  content: string
): Promise<JournalEntry> {
  const { data, error } = await supabase
    .from("journal_entries")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return parseJournalEntry(data as Record<string, unknown>);
}

export async function deleteEntry(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) throw error;
}
