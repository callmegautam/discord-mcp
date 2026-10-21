import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AuditLogEvent, PermissionFlagsBits } from "discord.js";
import { z } from "zod";
import {
  botMember,
  rankMember,
  requireMemberBelowBot,
  requireModeratableMember,
  requireNotAdministrator,
  requirePermissions,
} from "../discord/guards";
import { AUDIT_LOG_ACTIONS, MAX_BAN_DELETE_HOURS, MAX_TIMEOUT_MINUTES } from "../discord/moderation";
import { serializeAuditLogEntry, serializeBan, serializeMember, serializeUser } from "../discord/serialize";
import { run, UserError } from "../lib/result";
import { guildIdArg, reasonArg, snowflake } from "../lib/schemas";
import { findBan, findMember, getGuild, getMember, getUser, type ToolContext } from "./context";

const userIdArg = snowflake.describe("The user's ID.");

export function registerModerationTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "kick_member",
    {
      title: "Kick member",
      description:
        "Remove a member from the server. They can rejoin with an invite. The member has to be below the bot's highest role.",
      inputSchema: { guild_id: guildIdArg, user_id: userIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, user_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const member = await getMember(guild, user_id);
        requireModeratableMember(guild, member, PermissionFlagsBits.KickMembers);
        await member.kick(reason);
        return { kicked: serializeMember(member) };
      }),
  );

  server.registerTool(
    "ban_user",
    {
      title: "Ban user",
      description:
        "Ban a user from the server, whether or not they are a member right now, and optionally delete their recent messages. A member has to be below the bot's highest role.",
      inputSchema: {
        guild_id: guildIdArg,
        user_id: userIdArg,
        delete_message_hours: z
          .number()
          .int()
          .min(0)
          .max(MAX_BAN_DELETE_HOURS)
          .default(0)
          .describe(
            `Delete the user's messages from the last this many hours, 0 to ${MAX_BAN_DELETE_HOURS}.`,
          ),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, user_id, delete_message_hours, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const me = botMember(guild);
        requirePermissions(me.permissions, [PermissionFlagsBits.BanMembers]);
        const member = await findMember(guild, user_id);
        if (member) requireMemberBelowBot(guild.ownerId, rankMember(me), rankMember(member));
        const user = member?.user ?? (await getUser(ctx.client, user_id));
        if (await findBan(guild, user_id)) throw new UserError(`${user.username} is already banned.`);
        await guild.bans.create(user_id, { deleteMessageSeconds: delete_message_hours * 3600, reason });
        return { banned: serializeUser(user), deletedMessageHours: delete_message_hours };
      }),
  );

  server.registerTool(
    "unban_user",
    {
      title: "Unban user",
      description: "Lift a ban so the user can join again with an invite.",
      inputSchema: { guild_id: guildIdArg, user_id: userIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, user_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        requirePermissions(botMember(guild).permissions, [PermissionFlagsBits.BanMembers]);
        const ban = await findBan(guild, user_id);
        if (!ban) throw new UserError(`User ${user_id} is not banned from ${guild.name}.`);
        await guild.bans.remove(user_id, reason);
        return { unbanned: serializeBan(ban) };
      }),
  );

  server.registerTool(
    "list_bans",
    {
      title: "List bans",
      description:
        "List banned users with the ban reason, in pages ordered by user ID. Pass the returned nextAfter as after to get the next page.",
      inputSchema: {
        guild_id: guildIdArg,
        limit: z.number().int().min(1).max(1000).default(100).describe("Bans per page, 1 to 1000."),
        after: snowflake.optional().describe("Return bans with a user ID greater than this one."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, limit, after }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        requirePermissions(botMember(guild).permissions, [PermissionFlagsBits.BanMembers]);
        const bans = await guild.bans.fetch({ limit, after, cache: false });
        const page = [...bans.values()].map(serializeBan);
        return { bans: page, nextAfter: page.length === limit ? page.at(-1)!.user.id : null };
      }),
  );

  server.registerTool(
    "timeout_member",
    {
      title: "Timeout member",
      description:
        "Time out a member so they can't send messages, react, or join voice until it ends. Replaces any running timeout. Members with Administrator can't be timed out.",
      inputSchema: {
        guild_id: guildIdArg,
        user_id: userIdArg,
        duration_minutes: z
          .number()
          .int()
          .min(1)
          .max(MAX_TIMEOUT_MINUTES)
          .describe(`How long the timeout lasts, 1 to ${MAX_TIMEOUT_MINUTES} minutes (28 days).`),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, user_id, duration_minutes, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const member = await getMember(guild, user_id);
        requireModeratableMember(guild, member, PermissionFlagsBits.ModerateMembers);
        requireNotAdministrator(member.displayName, member.permissions);
        return serializeMember(await member.timeout(duration_minutes * 60_000, reason));
      }),
  );

  server.registerTool(
    "remove_timeout",
    {
      title: "Remove timeout",
      description: "End a member's timeout early.",
      inputSchema: { guild_id: guildIdArg, user_id: userIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, user_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const member = await getMember(guild, user_id);
        if (!member.isCommunicationDisabled()) throw new UserError(`${member.displayName} is not timed out.`);
        requireModeratableMember(guild, member, PermissionFlagsBits.ModerateMembers);
        return serializeMember(await member.timeout(null, reason));
      }),
  );

  server.registerTool(
    "get_audit_log",
    {
      title: "Get audit log",
      description:
        "Read the server audit log, newest first. Filter by action and by who did it. Pass the returned nextBefore as before to get older entries.",
      inputSchema: {
        guild_id: guildIdArg,
        action: z.enum(AUDIT_LOG_ACTIONS).optional().describe("Only this action, e.g. MemberBanAdd."),
        user_id: snowflake.optional().describe("Only actions done by this user."),
        limit: z.number().int().min(1).max(100).default(50).describe("Entries per page, 1 to 100."),
        before: snowflake.optional().describe("Return entries older than this entry ID."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, action, user_id, limit, before }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        requirePermissions(botMember(guild).permissions, [PermissionFlagsBits.ViewAuditLog]);
        const logs = await guild.fetchAuditLogs({
          type: action === undefined ? undefined : AuditLogEvent[action],
          user: user_id,
          limit,
          before,
        });
        const entries = [...logs.entries.values()].map(serializeAuditLogEntry);
        return { entries, nextBefore: entries.length === limit ? entries.at(-1)!.id : null };
      }),
  );
}
