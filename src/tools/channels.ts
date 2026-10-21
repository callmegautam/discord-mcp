import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  PermissionOverwrites,
  Role,
  type Guild,
  type GuildBasedChannel,
  type NonThreadGuildBasedChannel,
} from "discord.js";
import { z } from "zod";
import {
  buildOverwrite,
  CHANNEL_TYPE_NAMES,
  CHANNEL_TYPES,
  checkChannelFields,
  PERMISSION_NAMES,
  requireChannelTypeAvailable,
  type PermissionName,
} from "../discord/channels";
import { botMember, requirePermissions, requirePermissionsToGrant } from "../discord/guards";
import { serializeChannel, serializeOverwrite } from "../discord/serialize";
import { run, UserError } from "../lib/result";
import { guildIdArg, reasonArg, snowflake } from "../lib/schemas";
import { getCategory, getChannel, getGuild, getOverwriteTarget, type ToolContext } from "./context";

const channelIdArg = snowflake.describe("The channel or category ID.");
const nameArg = z.string().trim().min(1).max(100).describe("Channel name, 1 to 100 characters.");
const topicArg = z.string().max(4096).describe("Channel topic, up to 1024 characters (4096 for forums).");
const slowmodeArg = z
  .number()
  .int()
  .min(0)
  .max(21600)
  .describe("Seconds a member has to wait between messages, 0 to 21600. 0 turns slowmode off.");
const nsfwArg = z.boolean().describe("Whether the channel is age restricted.");
const positionArg = z.number().int().min(0).describe("Sort position, 0 is the top.");
const permissionList = (what: string) =>
  z.array(z.enum(PERMISSION_NAMES)).default([]).describe(`Permission names to ${what}, e.g. ViewChannel.`);

function label(channel: GuildBasedChannel): string {
  return channel.type === ChannelType.GuildCategory ? `category ${channel.name}` : `#${channel.name}`;
}

function overwriteName(guild: Guild, overwrite: Pick<PermissionOverwrites, "id" | "type">): string | null {
  return overwrite.type === OverwriteType.Role
    ? (guild.roles.cache.get(overwrite.id)?.name ?? null)
    : (guild.members.cache.get(overwrite.id)?.displayName ?? null);
}

// Without a channel level Manage Roles overwrite, Discord checks granted permissions against what
// the bot has in the parent category, or in the server when there is none.
function requireCanGrant(
  guild: Guild,
  channel: NonThreadGuildBasedChannel,
  granting: PermissionName[],
): void {
  const me = botMember(guild);
  const viaOverwrite = channel.permissionOverwrites.cache.some(
    (overwrite) =>
      (overwrite.id === me.id || me.roles.cache.has(overwrite.id)) &&
      overwrite.allow.has(PermissionFlagsBits.ManageRoles),
  );
  if (viaOverwrite || granting.length === 0) return;
  const parent = channel.parent;
  requirePermissionsToGrant(
    parent ? me.permissionsIn(parent) : me.permissions,
    granting,
    parent ? label(parent) : guild.name,
  );
}

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

  server.registerTool(
    "create_channel",
    {
      title: "Create channel",
      description:
        "Create a channel or category. Announcement and stage channels need a Community server. A new channel inside a category starts with the category's permissions.",
      inputSchema: {
        guild_id: guildIdArg,
        name: nameArg,
        type: z.enum(CHANNEL_TYPE_NAMES).default("text").describe("Kind of channel to create."),
        parent_id: snowflake.optional().describe("Category to put the channel in."),
        topic: topicArg.optional(),
        nsfw: nsfwArg.optional(),
        slowmode_seconds: slowmodeArg.optional(),
        position: positionArg.optional(),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, name, type, parent_id, topic, nsfw, slowmode_seconds, position, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const channelType = CHANNEL_TYPES[type];
        requireChannelTypeAvailable(channelType, guild.features);
        checkChannelFields(channelType, { topic, nsfw, slowmode_seconds, parent_id });
        const parent = parent_id ? await getCategory(guild, parent_id) : null;
        const me = botMember(guild);
        requirePermissions(
          parent ? me.permissionsIn(parent) : me.permissions,
          [PermissionFlagsBits.ManageChannels],
          parent ? label(parent) : undefined,
        );
        const channel = await guild.channels.create({
          name,
          type: channelType,
          parent,
          topic,
          nsfw,
          rateLimitPerUser: slowmode_seconds,
          position,
          reason,
        });
        return serializeChannel(channel);
      }),
  );

  server.registerTool(
    "edit_channel",
    {
      title: "Edit channel",
      description:
        "Change a channel's name, topic, slowmode, age restriction, category or position. Only the fields passed are changed.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        name: nameArg.optional(),
        topic: topicArg.nullable().optional().describe("New topic, null clears it."),
        nsfw: nsfwArg.optional(),
        slowmode_seconds: slowmodeArg.optional(),
        parent_id: snowflake
          .nullable()
          .optional()
          .describe("Category to move the channel to, null takes it out."),
        position: positionArg.optional(),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, channel_id, name, topic, nsfw, slowmode_seconds, parent_id, position, reason }) =>
      run(async () => {
        const changes = { name, topic, nsfw, slowmode_seconds, parent_id, position };
        if (Object.values(changes).every((value) => value === undefined)) {
          throw new UserError("Pass at least one field to change.");
        }
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        checkChannelFields(channel.type, changes);
        const me = botMember(guild);
        requirePermissions(me.permissionsIn(channel), [PermissionFlagsBits.ManageChannels], label(channel));
        const parent = typeof parent_id === "string" ? await getCategory(guild, parent_id) : parent_id;
        if (parent) {
          requirePermissions(me.permissionsIn(parent), [PermissionFlagsBits.ManageChannels], label(parent));
        }
        const edited = await channel.edit({
          name,
          topic,
          nsfw,
          rateLimitPerUser: slowmode_seconds,
          parent,
          position,
          reason,
        });
        return serializeChannel(edited);
      }),
  );

  server.registerTool(
    "delete_channel",
    {
      title: "Delete channel",
      description:
        "Permanently delete a channel or category and its messages. Deleting a category keeps its channels, they move out of it.",
      inputSchema: { guild_id: guildIdArg, channel_id: channelIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, channel_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        requirePermissions(
          botMember(guild).permissionsIn(channel),
          [PermissionFlagsBits.ManageChannels],
          label(channel),
        );
        const deleted = serializeChannel(channel);
        await guild.channels.delete(channel, reason);
        return { deleted };
      }),
  );

  server.registerTool(
    "clone_channel",
    {
      title: "Clone channel",
      description:
        "Create a copy of a channel next to it with the same settings and permission overwrites. Messages are not copied, and cloning a category does not copy its channels.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        name: nameArg.optional().describe("Name for the copy. Defaults to the original name."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, channel_id, name, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        const me = botMember(guild);
        const needed = [PermissionFlagsBits.ManageChannels];
        if (channel.permissionOverwrites.cache.size > 0) needed.push(PermissionFlagsBits.ManageRoles);
        requirePermissions(
          channel.parent ? me.permissionsIn(channel.parent) : me.permissions,
          needed,
          channel.parent ? label(channel.parent) : undefined,
        );
        return serializeChannel(await channel.clone({ name, reason }));
      }),
  );

  server.registerTool(
    "list_channel_permissions",
    {
      title: "List channel permissions",
      description:
        "List the permission overwrites on a channel or category: which roles and members get permissions allowed or denied there on top of their server roles.",
      inputSchema: { guild_id: guildIdArg, channel_id: channelIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, channel_id }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        const overwrites = [...channel.permissionOverwrites.cache.values()];
        const memberIds = overwrites.filter((o) => o.type === OverwriteType.Member).map((o) => o.id);
        if (memberIds.length > 0) await guild.members.fetch({ user: memberIds });
        return {
          channelId: channel.id,
          name: channel.name,
          syncedWithCategory: channel.permissionsLocked,
          overwrites: overwrites.map((overwrite) =>
            serializeOverwrite(overwrite, overwriteName(guild, overwrite)),
          ),
        };
      }),
  );

  server.registerTool(
    "set_channel_permission",
    {
      title: "Set channel permission",
      description:
        "Allow, deny or reset permissions for one role or member on a channel or category. Permissions not listed keep their current setting. Use the role ID of @everyone (the server ID) for everyone.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        target_id: snowflake.describe("Role ID or user ID the overwrite applies to."),
        allow: permissionList("allow"),
        deny: permissionList("deny"),
        inherit: permissionList("reset to inherit from the role and category"),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, channel_id, target_id, allow, deny, inherit, reason }) =>
      run(async () => {
        const options = buildOverwrite(allow, deny, inherit);
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        requirePermissions(
          botMember(guild).permissionsIn(channel),
          [PermissionFlagsBits.ManageRoles],
          label(channel),
        );
        requireCanGrant(guild, channel, [...allow, ...deny]);
        const target = await getOverwriteTarget(guild, target_id);
        const type = target instanceof Role ? OverwriteType.Role : OverwriteType.Member;
        const resolved = PermissionOverwrites.resolveOverwriteOptions(
          options,
          channel.permissionOverwrites.cache.get(target.id) ?? {},
        );
        await channel.permissionOverwrites.edit(target, options, { reason, type });
        return serializeOverwrite(
          { id: target.id, type, ...resolved },
          target instanceof Role ? target.name : target.displayName,
        );
      }),
  );

  server.registerTool(
    "remove_channel_permission",
    {
      title: "Remove channel permission",
      description:
        "Delete the permission overwrite for one role or member on a channel or category, so they fall back to their server roles and the category.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        target_id: snowflake.describe("Role ID or user ID whose overwrite to remove."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, channel_id, target_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        const existing = channel.permissionOverwrites.cache.get(target_id);
        if (!existing) throw new UserError(`${label(channel)} has no permission overwrite for ${target_id}.`);
        requirePermissions(
          botMember(guild).permissionsIn(channel),
          [PermissionFlagsBits.ManageRoles],
          label(channel),
        );
        const removed = serializeOverwrite(existing, overwriteName(guild, existing));
        await channel.permissionOverwrites.delete(target_id, reason);
        return { channelId: channel.id, removed };
      }),
  );
}
