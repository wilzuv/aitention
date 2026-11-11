// Shared types and constants for MCP tool definitions.
// Kept dependency-free so readTools.ts and writeTools.ts can both import
// from here without creating cycles through tools.ts.

export const MCP_TOOL_PREFIX = "aitention_";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type Params = Record<string, unknown>;
