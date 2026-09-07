// MCP token CRUD. Plaintext tokens are generated client-side, hashed
// (sha256) before insert, and returned to the caller exactly once at
// creation time. Only the hash and a short display prefix live in the DB.

import { SupabaseClient } from "@supabase/supabase-js";

export interface McpToken {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface CreatedMcpToken {
  token: McpToken;
  plaintext: string;
}

const TOKEN_BYTES = 32;

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function listTokens(supabase: SupabaseClient): Promise<McpToken[]> {
  const { data, error } = await supabase
    .from("mcp_tokens")
    .select("id, name, token_prefix, last_used_at, revoked_at, created_at")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as McpToken[];
}

export async function createToken(
  supabase: SupabaseClient,
  name: string
): Promise<CreatedMcpToken> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name required");

  const random = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(random);
  const plaintext = `aitn_${bytesToBase64Url(random)}`;
  const token_hash = await sha256Hex(plaintext);
  const token_prefix = plaintext.slice(0, 12);

  const { data, error } = await supabase
    .from("mcp_tokens")
    .insert({ name: trimmed, token_hash, token_prefix })
    .select("id, name, token_prefix, last_used_at, revoked_at, created_at")
    .single();
  if (error) throw error;

  return { token: data as McpToken, plaintext };
}

export async function revokeToken(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from("mcp_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
