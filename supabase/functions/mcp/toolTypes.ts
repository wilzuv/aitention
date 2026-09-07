// Shared types and constants for MCP tool definitions.
// Kept dependency-free so readTools.ts and writeTools.ts can both import
// from here without creating cycles through tools.ts.

export const MCP_TOOL_PREFIX = "aitention_";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // Client-facing annotations passed through tools/list verbatim. Used by
  // the ChatGPT Apps SDK ("openai/outputTemplate" → widget resource URI);
  // other MCP clients ignore it.
  _meta?: Record<string, unknown>;
}

export type Params = Record<string, unknown>;
