import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChannelTools } from "./channels";
import type { ToolContext } from "./context";
import { registerGuildTools } from "./guilds";
import { registerMemberTools } from "./members";
import { registerRoleTools } from "./roles";

export function registerTools(server: McpServer, ctx: ToolContext): void {
  registerGuildTools(server, ctx);
  registerChannelTools(server, ctx);
  registerRoleTools(server, ctx);
  registerMemberTools(server, ctx);
}
