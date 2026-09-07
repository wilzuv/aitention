// Aggregator for MCP tool surface. Reads + writes are defined in their own
// files so each can stand alone; this module merges them for the dispatcher
// in index.ts.

import type { ScopedClient } from "./scopedClient.ts";
import { READ_TOOLS, READ_HANDLERS } from "./readTools.ts";
import { WRITE_TOOLS, WRITE_HANDLERS } from "./writeTools.ts";
import { MCP_TOOL_PREFIX, type Params, type ToolDef } from "./toolTypes.ts";

export { MCP_TOOL_PREFIX, type ToolDef };

export const TOOLS: ToolDef[] = [...READ_TOOLS, ...WRITE_TOOLS];

const HANDLERS: Record<string, (c: ScopedClient, p: Params) => Promise<unknown>> = {
  ...READ_HANDLERS,
  ...WRITE_HANDLERS,
};

// Surface a clear failure if a name is registered twice. Module-init throw
// is intentional: the function should fail to boot on a collision rather
// than silently overwriting one handler with another.
{
  const seen = new Set<string>();
  for (const tool of TOOLS) {
    if (seen.has(tool.name)) {
      throw new Error(`Duplicate MCP tool registered: ${tool.name}`);
    }
    seen.add(tool.name);
  }
}

export async function executeTool(
  client: ScopedClient,
  name: string,
  params: Params,
): Promise<unknown> {
  const handler = HANDLERS[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(client, params ?? {});
}
