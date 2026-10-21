import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ChannelFlags, ChannelType, PermissionFlagsBits } from "discord.js";
import { z } from "zod";
import { botMember, requirePermissions } from "../discord/guards";
import { buildEmbeds } from "../discord/messages";
import { serializeThread } from "../discord/serialize";
import {
  AUTO_ARCHIVE_MINUTES,
  checkForumTags,
  MAX_APPLIED_TAGS,
  threadEditNeedsManage,
} from "../discord/threads";
import { run, UserError } from "../lib/result";
import { guildIdArg, reasonArg, snowflake } from "../lib/schemas";
import { getChannel, getGuild, getMessage, getThread, type ToolContext } from "./context";
import { contentArg, embedsArg } from "./messages";

const threadIdArg = snowflake.describe("The thread or forum post ID.");
const nameArg = z.string().trim().min(1).max(100).describe("Thread name, 1 to 100 characters.");
const autoArchiveArg = z
  .literal(AUTO_ARCHIVE_MINUTES)
  .describe("Minutes without activity before the thread is archived: 60, 1440, 4320 or 10080.");
const slowmodeArg = z
  .number()
  .int()
  .min(0)
  .max(21600)
  .describe("Seconds a member has to wait between messages, 0 to 21600.");
const tagIdsArg = z
  .array(snowflake)
  .max(MAX_APPLIED_TAGS)
  .describe(`Forum tag IDs, up to ${MAX_APPLIED_TAGS}. list_channels shows each forum's tags.`);

export function registerThreadTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_threads",
    {
      title: "List threads",
      description:
        "List active threads and forum posts in the server or one channel. With archived true, list a channel's archived threads instead, most recently archived first. Pass the returned nextBefore as before to get older ones.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: snowflake
          .optional()
          .describe("Only threads in this channel or forum. Required with archived."),
        archived: z.boolean().default(false).describe("List archived threads instead of active ones."),
        private: z
          .boolean()
          .default(false)
          .describe("With archived, list private threads instead of public ones. Needs Manage Threads."),
        limit: z.number().int().min(1).max(100).default(50).describe("Archived threads per page, 1 to 100."),
        before: z.iso
          .datetime({ offset: true })
          .optional()
          .describe("With archived, return threads archived before this ISO 8601 time."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, channel_id, archived, private: isPrivate, limit, before }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        if (!archived) {
          if (isPrivate || before) throw new UserError("private and before only work with archived true.");
          const { threads } = await guild.channels.fetchActiveThreads(false);
          const list = [...threads.values()].filter(
            (thread) => !channel_id || thread.parentId === channel_id,
          );
          return { threads: list.map(serializeThread) };
        }
        if (!channel_id) throw new UserError("Archived threads are listed per channel, pass channel_id.");
        const channel = await getChannel(guild, channel_id);
        if (!("threads" in channel)) throw new UserError(`${channel.name} has no threads.`);
        if (isPrivate && channel.type !== ChannelType.GuildText) {
          throw new UserError("Only text channels have private threads.");
        }
        requirePermissions(
          botMember(guild).permissionsIn(channel),
          [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
            ...(isPrivate ? [PermissionFlagsBits.ManageThreads] : []),
          ],
          `#${channel.name}`,
        );
        const { threads, hasMore } = await channel.threads.fetchArchived(
          { type: isPrivate ? "private" : "public", limit, before },
          false,
        );
        const list = [...threads.values()].map(serializeThread);
        return { threads: list, nextBefore: hasMore ? (list.at(-1)?.archivedAt ?? null) : null };
      }),
  );

  server.registerTool(
    "create_thread",
    {
      title: "Create thread",
      description:
        "Start a thread in a text or announcement channel, either from an existing message or on its own. Private threads only exist in text channels and can't start from a message. For forums use create_forum_post. Send messages into the thread with send_message and its ID.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: snowflake.describe("Text or announcement channel to start the thread in."),
        name: nameArg,
        message_id: snowflake.optional().describe("Start the thread from this message in the channel."),
        private: z.boolean().default(false).describe("Only members who are added or mentioned can see it."),
        auto_archive_minutes: autoArchiveArg.optional(),
        slowmode_seconds: slowmodeArg.optional(),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({
      guild_id,
      channel_id,
      name,
      message_id,
      private: isPrivate,
      auto_archive_minutes,
      slowmode_seconds,
      reason,
    }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
          throw new UserError(
            channel.isThreadOnly()
              ? `${channel.name} is a forum, use create_forum_post.`
              : `Threads start in text and announcement channels, ${channel.name} is neither.`,
          );
        }
        if (isPrivate && message_id) throw new UserError("A thread started from a message is always public.");
        if (isPrivate && channel.type === ChannelType.GuildAnnouncement) {
          throw new UserError("Announcement channels only have public threads.");
        }
        requirePermissions(
          botMember(guild).permissionsIn(channel),
          [
            PermissionFlagsBits.ViewChannel,
            isPrivate ? PermissionFlagsBits.CreatePrivateThreads : PermissionFlagsBits.CreatePublicThreads,
            ...(message_id ? [PermissionFlagsBits.ReadMessageHistory] : []),
          ],
          `#${channel.name}`,
        );
        if (message_id) await getMessage(channel, message_id);
        const options = {
          name,
          startMessage: message_id,
          autoArchiveDuration: auto_archive_minutes,
          rateLimitPerUser: slowmode_seconds,
          reason,
        };
        const thread =
          channel.type === ChannelType.GuildText
            ? await channel.threads.create({
                ...options,
                type: isPrivate ? ChannelType.PrivateThread : ChannelType.PublicThread,
              })
            : await channel.threads.create(options);
        return serializeThread(thread);
      }),
  );

  server.registerTool(
    "create_forum_post",
    {
      title: "Create forum post",
      description:
        "Start a post in a forum or media channel with a title, a first message and tags. @everyone, @here and role mentions in it don't ping.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: snowflake.describe("The forum or media channel."),
        name: nameArg.describe("Post title, 1 to 100 characters."),
        content: contentArg.optional(),
        embeds: embedsArg.optional(),
        tag_ids: tagIdsArg.default([]),
        auto_archive_minutes: autoArchiveArg.optional(),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, channel_id, name, content, embeds, tag_ids, auto_archive_minutes, reason }) =>
      run(async () => {
        if (!content && !embeds?.length)
          throw new UserError("Pass content, embeds or both for the first message.");
        const guild = getGuild(ctx, guild_id);
        const channel = await getChannel(guild, channel_id);
        if (!channel.isThreadOnly()) throw new UserError(`${channel.name} is not a forum or media channel.`);
        const have = botMember(guild).permissionsIn(channel);
        requirePermissions(
          have,
          [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            ...(embeds?.length ? [PermissionFlagsBits.EmbedLinks] : []),
          ],
          `#${channel.name}`,
        );
        const tags = [...new Set(tag_ids)];
        checkForumTags(channel.availableTags, tags, {
          requireTag: channel.flags.has(ChannelFlags.RequireTag),
          canModerate: have.has(PermissionFlagsBits.ManageThreads),
        });
        const thread = await channel.threads.create({
          name,
          appliedTags: tags,
          autoArchiveDuration: auto_archive_minutes,
          message: { content, embeds: embeds && buildEmbeds(embeds), allowedMentions: { parse: ["users"] } },
          reason,
        });
        // A forum post's first message has the same ID as the post.
        return { ...serializeThread(thread), starterMessageId: thread.id };
      }),
  );

  server.registerTool(
    "edit_thread",
    {
      title: "Edit thread",
      description:
        "Rename, archive, reopen, lock or unlock a thread or forum post, or change its slowmode, auto archive time or tags. An archived thread has to be reopened with archived false to change anything else. Only the fields passed are changed.",
      inputSchema: {
        guild_id: guildIdArg,
        thread_id: threadIdArg,
        name: nameArg.optional(),
        archived: z.boolean().optional().describe("true archives the thread, false reopens it."),
        locked: z
          .boolean()
          .optional()
          .describe("A locked thread can only be reopened by members with Manage Threads."),
        auto_archive_minutes: autoArchiveArg.optional(),
        slowmode_seconds: slowmodeArg.optional(),
        tag_ids: tagIdsArg.optional().describe("Replace a forum post's tags. An empty list removes them."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({
      guild_id,
      thread_id,
      name,
      archived,
      locked,
      auto_archive_minutes,
      slowmode_seconds,
      tag_ids,
      reason,
    }) =>
      run(async () => {
        const changes = { name, archived, locked, auto_archive_minutes, slowmode_seconds, tag_ids };
        if (Object.values(changes).every((value) => value === undefined)) {
          throw new UserError("Pass at least one field to change.");
        }
        const guild = getGuild(ctx, guild_id);
        const thread = await getThread(guild, thread_id);
        if (thread.archived && archived !== false) {
          throw new UserError(
            `${thread.name} is archived. Pass archived false to reopen it, with or without other changes.`,
          );
        }
        const parent = thread.parent;
        if (!parent) throw new UserError(`The channel ${thread.name} belongs to is not available.`);
        const have = botMember(guild).permissionsIn(thread);
        const needsManage = threadEditNeedsManage(changes, {
          ownedByBot: thread.ownerId === ctx.client.user.id,
          locked: thread.locked ?? false,
        });
        requirePermissions(
          have,
          [PermissionFlagsBits.ViewChannel, ...(needsManage ? [PermissionFlagsBits.ManageThreads] : [])],
          thread.name,
        );
        const tags = tag_ids && [...new Set(tag_ids)];
        if (tags) {
          if (!parent.isThreadOnly()) throw new UserError("tag_ids only work on forum posts.");
          checkForumTags(parent.availableTags, tags, {
            requireTag: parent.flags.has(ChannelFlags.RequireTag),
            canModerate: have.has(PermissionFlagsBits.ManageThreads),
          });
        }
        const edited = await thread.edit({
          name,
          archived,
          locked,
          autoArchiveDuration: auto_archive_minutes,
          rateLimitPerUser: slowmode_seconds,
          appliedTags: tags,
          reason,
        });
        return serializeThread(edited);
      }),
  );

  server.registerTool(
    "delete_thread",
    {
      title: "Delete thread",
      description: "Permanently delete a thread or forum post and every message in it.",
      inputSchema: { guild_id: guildIdArg, thread_id: threadIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, thread_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const thread = await getThread(guild, thread_id);
        requirePermissions(
          botMember(guild).permissionsIn(thread),
          [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageThreads],
          thread.name,
        );
        const deleted = serializeThread(thread);
        await thread.delete(reason);
        return { deleted };
      }),
  );
}
