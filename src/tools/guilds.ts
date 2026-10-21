import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serializeGuild, serializeGuildSummary } from "../discord/serialize";
import { run } from "../lib/result";
import { guildIdArg } from "../lib/schemas";
import { getGuild, type ToolContext } from "./context";

export function registerGuildTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_guilds",
    {
      title: "List servers",
      description: "List every Discord server the bot is a member of.",
      annotations: { readOnlyHint: true },
    },
    () => run(() => ctx.client.guilds.cache.map(serializeGuildSummary)),
  );

  server.registerTool(
    "get_guild",
    {
      title: "Get server info",
      description:
        "Get details about a server: owner, member count, verification level, boosts and features.",
      inputSchema: { guild_id: guildIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id }) => run(async () => serializeGuild(await getGuild(ctx, guild_id).fetch())),
  );
}
