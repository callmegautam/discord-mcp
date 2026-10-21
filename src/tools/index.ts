import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChannelTools } from "./channels";
import type { ToolContext } from "./context";
import { registerGuildTools } from "./guilds";
import { registerMemberTools } from "./members";
import { applyToolPolicy, trackTools } from "./policy";
import { registerRoleTools } from "./roles";

/** Registers every tool, then applies READ_ONLY and DISABLED_TOOLS. Returns the active tool names. */
export function registerTools(server: McpServer, ctx: ToolContext): string[] {
  const { server: tracked, tools } = trackTools(server);
  registerGuildTools(tracked, ctx);
  registerChannelTools(tracked, ctx);
  registerRoleTools(tracked, ctx);
  registerMemberTools(tracked, ctx);
  return applyToolPolicy(tools, ctx.config);
}
