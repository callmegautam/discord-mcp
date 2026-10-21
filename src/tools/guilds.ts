import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { z } from "zod";
import { MAX_IMAGE_BYTES, downloadFile } from "../discord/files";
import { botMember, requirePermissions } from "../discord/guards";
import {
  requireVerificationLevelAllowed,
  VERIFICATION_LEVEL_NAMES,
  VERIFICATION_LEVELS,
} from "../discord/guilds";
import { serializeGuild, serializeGuildSummary } from "../discord/serialize";
import { run, UserError } from "../lib/result";
import { guildIdArg, httpsUrlArg, reasonArg, snowflake } from "../lib/schemas";
import { allowedGuilds, getChannel, getGuild, type ToolContext } from "./context";

export function registerGuildTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_guilds",
    {
      title: "List servers",
      description:
        "List every Discord server the bot is a member of, limited to ALLOWED_GUILD_IDS when that is set.",
      annotations: { readOnlyHint: true },
    },
    () => run(() => allowedGuilds(ctx).map(serializeGuildSummary)),
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

  server.registerTool(
    "edit_guild",
    {
      title: "Edit server settings",
      description:
        "Change the server's name, icon, verification level or system channel, where Discord posts join and boost messages. Only the fields passed are changed.",
      inputSchema: {
        guild_id: guildIdArg,
        name: z.string().trim().min(2).max(100).optional().describe("Server name, 2 to 100 characters."),
        icon_url: httpsUrlArg
          .nullable()
          .optional()
          .describe("https URL of a new icon image, null removes the icon. Animated icons need boosts."),
        verification_level: z
          .enum(VERIFICATION_LEVEL_NAMES)
          .optional()
          .describe(
            "What new members need before they can talk: none, low (verified email), medium (account older than 5 minutes), high (member for 10 minutes), very_high (verified phone).",
          ),
        system_channel_id: snowflake
          .nullable()
          .optional()
          .describe("Text channel for join and boost messages, null turns them off."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, name, icon_url, verification_level, system_channel_id, reason }) =>
      run(async () => {
        if ([name, icon_url, verification_level, system_channel_id].every((value) => value === undefined)) {
          throw new UserError("Pass at least one field to change.");
        }
        const guild = getGuild(ctx, guild_id);
        requirePermissions(botMember(guild).permissions, [PermissionFlagsBits.ManageGuild]);
        const verificationLevel = verification_level && VERIFICATION_LEVELS[verification_level];
        if (verificationLevel !== undefined)
          requireVerificationLevelAllowed(verificationLevel, guild.features);
        if (system_channel_id) {
          const channel = await getChannel(guild, system_channel_id);
          if (channel.type !== ChannelType.GuildText) {
            throw new UserError(`${channel.name} is not a text channel, the system channel has to be one.`);
          }
        }
        const icon = icon_url ? await downloadFile(icon_url, MAX_IMAGE_BYTES) : icon_url;
        const edited = await guild.edit({
          name,
          icon,
          verificationLevel,
          systemChannel: system_channel_id,
          reason,
        });
        return serializeGuild(edited);
      }),
  );
}
