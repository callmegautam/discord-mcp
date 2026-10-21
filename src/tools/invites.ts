import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PermissionFlagsBits } from "discord.js";
import { z } from "zod";
import { botMember, requirePermissions } from "../discord/guards";
import { parseInviteCode } from "../discord/invites";
import { serializeInvite } from "../discord/serialize";
import { run, UserError } from "../lib/result";
import { guildIdArg, reasonArg, snowflake } from "../lib/schemas";
import { getChannel, getGuild, getInvite, type ToolContext } from "./context";

const MAX_INVITE_AGE_SECONDS = 7 * 24 * 60 * 60;

export function registerInviteTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_invites",
    {
      title: "List invites",
      description:
        "List the server's active invites with their uses and expiry, or only the ones for one channel. Needs Manage Server, or Manage Channels for one channel.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: snowflake.optional().describe("Only list invites to this channel."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, channel_id }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const me = botMember(guild);
        if (channel_id) {
          const channel = await getChannel(guild, channel_id);
          requirePermissions(
            me.permissionsIn(channel),
            [PermissionFlagsBits.ManageChannels],
            `#${channel.name}`,
          );
          const invites = await guild.invites.fetch({ channelId: channel.id, cache: false });
          return [...invites.values()].map(serializeInvite);
        }
        requirePermissions(me.permissions, [PermissionFlagsBits.ManageGuild]);
        const invites = await guild.invites.fetch({ cache: false });
        return [...invites.values()].map(serializeInvite);
      }),
  );

  server.registerTool(
    "create_invite",
    {
      title: "Create invite",
      description:
        "Create an invite link to a channel. By default it lasts 24 hours with unlimited uses, and an existing invite with the same settings is reused unless unique is true.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: snowflake.describe("Channel the invite leads to."),
        max_age_seconds: z
          .number()
          .int()
          .min(0)
          .max(MAX_INVITE_AGE_SECONDS)
          .default(86400)
          .describe(
            `Seconds until the invite expires, up to ${MAX_INVITE_AGE_SECONDS} (7 days). 0 never expires.`,
          ),
        max_uses: z
          .number()
          .int()
          .min(0)
          .max(100)
          .default(0)
          .describe("How often it can be used, 0 is unlimited."),
        temporary: z
          .boolean()
          .default(false)
          .describe("Members who join through it are removed when they go offline, unless they got a role."),
        unique: z
          .boolean()
          .default(false)
          .describe("Always create a new invite instead of reusing a matching one."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, channel_id, max_age_seconds, max_uses, temporary, unique, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        if (!("createInvite" in channel))
          throw new UserError(`${channel.name} is a category, invites lead to channels.`);
        requirePermissions(
          botMember(guild).permissionsIn(channel),
          [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.CreateInstantInvite],
          `#${channel.name}`,
        );
        const invite = await guild.invites.create(channel, {
          maxAge: max_age_seconds,
          maxUses: max_uses,
          temporary,
          unique,
          reason,
        });
        return serializeInvite(invite);
      }),
  );

  server.registerTool(
    "delete_invite",
    {
      title: "Delete invite",
      description: "Revoke an invite so the link stops working. Takes the code or the full link.",
      inputSchema: {
        guild_id: guildIdArg,
        code: z.string().trim().min(2).max(300).describe("Invite code like abc123, or a discord.gg link."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, code, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const invite = await getInvite(ctx.client, guild, parseInviteCode(code));
        const me = botMember(guild);
        const channel = invite.channelId ? guild.channels.cache.get(invite.channelId) : undefined;
        // Manage Server covers every invite, Manage Channels only the channel's own.
        if (!me.permissions.has(PermissionFlagsBits.ManageGuild)) {
          if (!channel) requirePermissions(me.permissions, [PermissionFlagsBits.ManageGuild]);
          else
            requirePermissions(
              me.permissionsIn(channel),
              [PermissionFlagsBits.ManageChannels],
              `#${channel.name}`,
            );
        }
        const deleted = serializeInvite(invite);
        await guild.invites.delete(invite.code, reason);
        return { deleted };
      }),
  );
}
