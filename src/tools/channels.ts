import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { NonThreadGuildBasedChannel } from "discord.js";
import { serializeChannel } from "../discord/serialize";
import { run } from "../lib/result";
import { guildIdArg } from "../lib/schemas";
import { getGuild, type ToolContext } from "./context";

export function registerChannelTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_channels",
    {
      title: "List channels",
      description:
        "List all channels and categories in a server. Channels inside a category have its ID as parentId.",
      inputSchema: { guild_id: guildIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id }) =>
      run(async () => {
        const channels = await getGuild(ctx, guild_id).channels.fetch();
        return [...channels.values()]
          .filter((channel): channel is NonThreadGuildBasedChannel => channel !== null)
          .map(serializeChannel)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      }),
  );
}
