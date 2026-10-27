import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getObjectShape } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { Config } from "../config";
import { logger } from "../lib/logger";

/** Wraps a server so every tool registered through it is recorded by name. */
export function trackTools(server: McpServer): { server: McpServer; tools: Map<string, RegisteredTool> } {
  const tools = new Map<string, RegisteredTool>();
  const tracked = new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== "registerTool") return Reflect.get(target, prop, receiver);
      // registerTool is generic, so forward the arguments untouched instead of retyping them.
      return (name: string, ...rest: unknown[]) => {
        const tool = Reflect.apply(target.registerTool, target, [name, ...rest]) as RegisteredTool;
        tools.set(name, tool);
        return tool;
      };
    },
  });
  return { server: tracked, tools };
}

// MCP treats a missing destructiveHint on a write tool as destructive, so every tool has to say
// what it is, and read-only mode can rely on the same annotations the client sees.
export function checkAnnotations(name: string, tool: RegisteredTool): void {
  const { readOnlyHint, destructiveHint } = tool.annotations ?? {};
  if (readOnlyHint === undefined) throw new Error(`Tool ${name} must set readOnlyHint.`);
  if (readOnlyHint) return;
  if (destructiveHint === undefined) throw new Error(`Tool ${name} must set destructiveHint.`);
  if (destructiveHint && !getObjectShape(tool.inputSchema)?.["reason"]) {
    throw new Error(`Destructive tool ${name} must accept a reason for the audit log.`);
  }
}

/** Enforces the annotation rules and removes tools turned off by config. Returns the active names. */
export function applyToolPolicy(
  tools: ReadonlyMap<string, RegisteredTool>,
  config: Pick<Config, "readOnly" | "disabledTools">,
  log = true,
): string[] {
  for (const [name, tool] of tools) checkAnnotations(name, tool);

  const unknown = config.disabledTools.filter((name) => !tools.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `DISABLED_TOOLS has unknown tools: ${unknown.join(", ")}. Known tools: ${[...tools.keys()].join(", ")}`,
    );
  }

  const active: string[] = [];
  for (const [name, tool] of tools) {
    if (config.disabledTools.includes(name)) {
      tool.remove();
      if (log) logger.info(`tool ${name} disabled by DISABLED_TOOLS`);
    } else if (config.readOnly && !tool.annotations?.readOnlyHint) {
      tool.remove();
      if (log) logger.info(`tool ${name} skipped, READ_ONLY is on`);
    } else {
      active.push(name);
    }
  }
  return active;
}
