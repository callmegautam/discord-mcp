import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { snowflake } from "../lib/schemas";
import { UserError } from "../lib/result";
import { allowedGuilds, fetchSnapshot, getGuild, type ToolContext } from "../tools/context";

export const SNAPSHOT_URI = "discord://guilds/{guild_id}/snapshot";

export function snapshotUri(guildId: string): string {
  return SNAPSHOT_URI.replace("{guild_id}", guildId);
}

export function registerResources(server: McpServer, ctx: ToolContext): void {
  server.registerResource(
    "server_snapshot",
    new ResourceTemplate(SNAPSHOT_URI, {
      list: () => ({
        resources: allowedGuilds(ctx).map((guild) => ({
          uri: snapshotUri(guild.id),
          name: `${guild.name} snapshot`,
          mimeType: "application/json",
        })),
      }),
    }),
    {
      title: "Server snapshot",
      description:
        "A server's settings, roles with their permissions and member counts, and channels with their permission overwrites, as JSON. Read it to understand a server's layout without calling several tools.",
      mimeType: "application/json",
    },
    async (uri, { guild_id }) => {
      const id = snowflake.safeParse(guild_id);
      if (!id.success) throw new UserError(`${String(guild_id)} is not a Discord server ID.`);
      const snapshot = await fetchSnapshot(getGuild(ctx, id.data));
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(snapshot, null, 2) }],
      };
    },
  );
}
