// MCP authentication.
//
// Two paths, tried in order:
//   1. Stytch JWT (Phase 2) — claude.ai / ChatGPT etc. obtain an access
//      token via OAuth + DCR; we verify it with the Stytch JWKS and extract
//      the `supabase_uid` custom claim seeded by the Trusted Auth Token
//      profile.
//   2. mcp_tokens bearer (Phase 1) — hand-pasted tokens for Claude Desktop
//      power users. Retired in spec Step 8 once Stytch is verified on main.
//
// In both cases the user_id feeds into ScopedClient, which forces
// `user_id = $userId` onto every Postgres operation. RLS is bypassed; compound foreign keys enforce relationship ownership.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createRemoteJWKSet } from "https://esm.sh/jose@5";
import { ScopedClient } from "./scopedClient.ts";
import { verifyMcpToken } from "./verifyMcpToken.ts";
import { mcpPublicUrl } from "./oauthMetadata.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STYTCH_DOMAIN = Deno.env.get("STYTCH_DOMAIN");
const MCP_AUDIENCE = mcpPublicUrl();

const SERVICE_CLIENT = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Lazy: only build the JWKS fetcher if Stytch is configured. Avoids a
// pointless network call when the function runs Phase-1-only.
const STYTCH_JWKS = STYTCH_DOMAIN
  ? createRemoteJWKSet(new URL(`${STYTCH_DOMAIN}/.well-known/jwks.json`))
  : null;

// ── sha256 helper ─────────────────────────────────────────────────────────

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Public surface ────────────────────────────────────────────────────────

export interface AuthedRequest {
  userId: string;
  tokenId: string;
  scopedClient: ScopedClient;
}

/**
 * Verify a Stytch-issued access token and extract the linked Supabase user.
 * Returns null on any failure (unconfigured, bad signature, missing claim).
 */
async function authenticateStytch(token: string): Promise<AuthedRequest | null> {
  if (!STYTCH_JWKS || !STYTCH_DOMAIN || !MCP_AUDIENCE) return null;

  try {
    const { userId: supabaseUid, subject } = await verifyMcpToken(
      token, STYTCH_JWKS, STYTCH_DOMAIN, MCP_AUDIENCE,
    );

    return {
      userId: supabaseUid,
      tokenId: `stytch:${subject}`,
      scopedClient: new ScopedClient(supabaseUid, SERVICE_CLIENT),
    };
  } catch {
    return null;
  }
}

/**
 * Verify a hand-issued mcp_tokens bearer token. Retained alongside Stytch
 * during the Phase 2 rollout; remove once Step 8 retires the bearer path.
 */
async function authenticateBearer(plaintext: string): Promise<AuthedRequest | null> {
  const tokenHash = await sha256Hex(plaintext);

  const { data, error } = await SERVICE_CLIENT
    .from("mcp_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Fire-and-forget last_used_at update; don't block the request.
  SERVICE_CLIENT
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return {
    userId: data.user_id,
    tokenId: data.id,
    scopedClient: new ScopedClient(data.user_id, SERVICE_CLIENT),
  };
}

/**
 * Resolve a bearer token to an authenticated, user-scoped Supabase client.
 * Tries Stytch first, then falls back to the legacy mcp_tokens path.
 * Returns null if the header is missing/malformed or no path validates.
 */
export async function authenticate(
  authHeader: string | null,
): Promise<AuthedRequest | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const plaintext = match[1].trim();
  if (!plaintext) return null;

  // Stytch tokens are JWTs (three base64url segments separated by '.').
  // mcp_tokens are random base64url strings without dots. Use that shape
  // hint to avoid hitting the DB for every JWT verification attempt.
  if (plaintext.includes(".")) {
    const stytch = await authenticateStytch(plaintext);
    if (stytch) return stytch;
    // Fall through — a JWT-shaped string could still match a long bearer
    // token by coincidence, though it's vanishingly unlikely.
  }

  return authenticateBearer(plaintext);
}
