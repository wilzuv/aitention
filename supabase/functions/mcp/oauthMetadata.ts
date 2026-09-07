// OAuth 2.0 Protected Resource Metadata (RFC 9728).
//
// MCP clients (claude.ai etc.) bootstrap their OAuth flow against a remote
// MCP server by following the `resource_metadata` URL in our 401's
// WWW-Authenticate header. That URL points here. The doc tells the client
// which authorization server to talk to (Stytch) and what scopes exist.
//
// The `resource` field MUST be the canonical *public* URL of the MCP
// endpoint — clients use it to bind issued tokens to a specific resource
// server, and they fetch the metadata URL we advertise from the outside.
// We can't derive this from `req.url` because Supabase Edge Functions
// receive a gateway-rewritten URL (internal http://… without the
// /functions/v1 prefix). Build from SUPABASE_URL instead.

const STYTCH_DOMAIN = Deno.env.get("STYTCH_DOMAIN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
// Allow override so local dev (supabase functions serve) can point at the
// local gateway, and so prod could be moved behind a custom domain later.
const MCP_PUBLIC_URL_OVERRIDE = Deno.env.get("MCP_PUBLIC_URL");

export function mcpPublicUrl(): string | null {
  if (MCP_PUBLIC_URL_OVERRIDE) return MCP_PUBLIC_URL_OVERRIDE.replace(/\/$/, "");
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/mcp`;
}

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
}

/**
 * Build the PRM document. Returns null if Stytch isn't configured or we
 * can't determine our own public URL (a hard misconfig — better to 404
 * than hand clients a broken doc).
 */
export function protectedResourceMetadata(
  _req: Request,
): ProtectedResourceMetadata | null {
  if (!STYTCH_DOMAIN) return null;
  const resource = mcpPublicUrl();
  if (!resource) return null;

  return {
    resource,
    authorization_servers: [STYTCH_DOMAIN],
    scopes_supported: ["openid", "email", "profile"],
    bearer_methods_supported: ["header"],
  };
}

/**
 * URL clients should GET to discover this metadata document. Used to build
 * the `resource_metadata` parameter in WWW-Authenticate. Returns null when
 * misconfigured so callers can omit the hint rather than emit a bad one.
 */
export function metadataUrl(_req: Request): string | null {
  const base = mcpPublicUrl();
  if (!base) return null;
  return `${base}/.well-known/oauth-protected-resource`;
}
