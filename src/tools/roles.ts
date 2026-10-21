import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serializeRole } from "../discord/serialize";
import { run } from "../lib/result";
import { guildIdArg } from "../lib/schemas";
import { getGuild, type ToolContext } from "./context";

export function registerRoleTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_roles",
    {
      title: "List roles",
      description:
        "List all roles in a server, highest first, with their permissions. The bot can only manage roles below its own highest role.",
      inputSchema: { guild_id: guildIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id }) =>
      run(async () => {
        const roles = await getGuild(ctx, guild_id).roles.fetch();
        return [...roles.values()].sort((a, b) => b.position - a.position).map(serializeRole);
      }),
  );
}
