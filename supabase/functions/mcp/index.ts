// Aitention MCP server.
//
// Streamable HTTP transport: client POSTs JSON-RPC, server returns a single
// JSON-RPC response. No SSE — every method we implement returns immediately.
//
// Feature gate: when MCP_ENABLED env var is not "true", every request returns
// 404 so the function can ship to prod ahead of being switched on.
//
// Auth (Phase 2): two paths, tried in order in auth.ts.
//   1. Stytch-issued JWT (claude.ai et al. via OAuth + DCR). Discovery is
//      bootstrapped by HTTP 401 + WWW-Authenticate pointing at our PRM doc
//      at /.well-known/oauth-protected-resource (served from this function).
//   2. Hand-issued mcp_tokens bearer (Phase 1, retired in spec Step 8).
//
// Either way the resolved user_id feeds into a ScopedClient that forces
// `user_id = $userId` on every Postgres operation — RLS is bypassed; compound foreign keys enforce relationship ownership.

import { authenticate } from "./auth.ts";
import { TOOLS, executeTool } from "./tools.ts";
import { NotFoundError, ValidationError } from "./helpers.ts";
import { RESOURCES, readResource } from "./resources.ts";
import { ERR, err, ok, type JsonRpcRequest, type JsonRpcResponse } from "./jsonrpc.ts";
import { metadataUrl, protectedResourceMetadata } from "./oauthMetadata.ts";
import { WIDGETS_BY_TOOL } from "./widgets.ts";

const SERVER_INFO = { name: "aitention", version: "0.1.0" };
const PROTOCOL_VERSION = "2025-06-18";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  // MCP clients usually have no Origin (they're not browsers); respond with *
  // when origin is missing so Claude Desktop / Codex can connect cleanly.
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function unauthorizedHeaders(req: Request, cors: Record<string, string>) {
  // RFC 9728 §5.1: point clients at the PRM doc so they can discover the
  // authorization server. Without this hint, claude.ai's connector flow
  // can't bootstrap.
  const headers: Record<string, string> = { ...cors };
  const md = metadataUrl(req);
  if (Deno.env.get("STYTCH_DOMAIN") && md) {
    headers["WWW-Authenticate"] =
      `Bearer realm="aitention", resource_metadata="${md}"`;
  }
  return headers;
}

function jsonResponse(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

// Methods that don't require an authenticated user. Everything else needs
// a valid Stytch or mcp_tokens bearer.
//
// `initialize` is intentionally NOT public. OAuth-aware MCP clients
// (claude.ai, mcp-remote, Claude Desktop) only begin their OAuth flow when
// their FIRST request returns 401 + WWW-Authenticate. If initialize returns
// 200 to an unauthenticated client, the client concludes no auth is required,
// skips OAuth entirely, and never discovers the authorization server (Stytch).
// Gating initialize behind auth is what bootstraps the whole discovery →
// Stytch → consent → token chain. The CLI is unaffected: it sends its bearer
// on every request, so its initialize authenticates and returns 200.
const PUBLIC_METHODS = new Set([
  "notifications/initialized",
  "ping",
]);

function requiresAuth(rpc: JsonRpcRequest): boolean {
  return !PUBLIC_METHODS.has(rpc.method);
}

async function handleRpc(
  rpc: JsonRpcRequest,
  auth: Awaited<ReturnType<typeof authenticate>>,
): Promise<JsonRpcResponse | null> {
  const id = rpc.id ?? null;

  // Notifications (no id) — spec says don't respond.
  const isNotification = rpc.id === undefined || rpc.id === null;

  // initialize, once authenticated, negotiates capabilities. Unauthenticated
  // initialize never reaches here — it's caught by the HTTP-layer 401 above,
  // which is what triggers the client's OAuth discovery.
  if (rpc.method === "initialize") {
    return ok(id, {
      protocolVersion: PROTOCOL_VERSION,
      serverInfo: SERVER_INFO,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
      },
    });
  }

  if (rpc.method === "notifications/initialized") return null;
  if (rpc.method === "ping") return ok(id, {});

  // Auth is enforced at the HTTP layer (401 + WWW-Authenticate); reaching
  // here without an auth means the caller is mixing public and private
  // methods in one batch — surface as a JSON-RPC error.
  if (!auth) {
    return isNotification ? null : err(id, ERR.INVALID_REQUEST, "Unauthorized");
  }

  try {
    switch (rpc.method) {
      case "tools/list":
        return ok(id, {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            ...(t._meta ? { _meta: t._meta } : {}),
          })),
        });

      case "tools/call": {
        const params = (rpc.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        if (!params.name) return err(id, ERR.INVALID_PARAMS, "Missing tool name");
        const result = await executeTool(auth.scopedClient, params.name, params.arguments ?? {});
        // Tools with an Apps SDK widget also return structuredContent — the
        // payload that hydrates the widget iframe (window.openai.toolOutput).
        // The text content stays as-is for clients that ignore widgets.
        const widget = WIDGETS_BY_TOOL[params.name];
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          ...(widget ? { structuredContent: widget.structuredContent(result) } : {}),
          isError: false,
        });
      }

      case "resources/list":
        return ok(id, { resources: RESOURCES });

      case "resources/read": {
        const params = (rpc.params ?? {}) as { uri?: string };
        if (!params.uri) return err(id, ERR.INVALID_PARAMS, "Missing resource uri");
        const out = await readResource(auth.scopedClient, params.uri);
        if (!out) return err(id, ERR.INVALID_PARAMS, `Unknown resource: ${params.uri}`);
        return ok(id, { contents: [out] });
      }

      case "prompts/list":
        // Phase 4 will populate this. Empty list keeps clients happy.
        return ok(id, { prompts: [] });

      default:
        return isNotification ? null : err(id, ERR.METHOD_NOT_FOUND, `Unknown method: ${rpc.method}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    // Surface caller-actionable errors as INVALID_PARAMS so MCP clients can
    // distinguish "you passed bad input" from "the server blew up".
    if (e instanceof NotFoundError || e instanceof ValidationError) {
      return err(id, ERR.INVALID_PARAMS, msg);
    }
    return err(id, ERR.INTERNAL, msg);
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // Feature flag: disabled by default.
  if (Deno.env.get("MCP_ENABLED") !== "true") {
    return new Response("Not found", { status: 404, headers: cors });
  }

  // RFC 9728 Protected Resource Metadata — clients dereference this URL
  // (advertised in the WWW-Authenticate header) to discover the auth server.
  const url = new URL(req.url);
  if (
    req.method === "GET" &&
    url.pathname.endsWith("/.well-known/oauth-protected-resource")
  ) {
    const doc = protectedResourceMetadata(req);
    if (!doc) {
      return new Response("OAuth not configured", { status: 404, headers: cors });
    }
    return jsonResponse(doc, 200, cors);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POST required" }, 405, cors);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(err(null, ERR.PARSE, "Parse error"), 400, cors);
  }

  const requests = (Array.isArray(body) ? body : [body]) as JsonRpcRequest[];
  const authHeader = req.headers.get("authorization");

  // Authenticate once per request. If any contained method requires auth
  // and the bearer doesn't validate, return HTTP 401 with WWW-Authenticate
  // — this is what bootstraps claude.ai's OAuth discovery against the PRM.
  const needsAuth = requests.some(requiresAuth);
  const auth = needsAuth ? await authenticate(authHeader) : null;
  if (needsAuth && !auth) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...unauthorizedHeaders(req, cors),
        },
      },
    );
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(
      requests.map((rpc) => handleRpc(rpc, auth)),
    );
    const filtered = responses.filter((r): r is JsonRpcResponse => r !== null);
    return jsonResponse(filtered, 200, cors);
  }

  const response = await handleRpc(body as JsonRpcRequest, auth);
  if (!response) return new Response(null, { status: 204, headers: cors });
  return jsonResponse(response, 200, cors);
});
