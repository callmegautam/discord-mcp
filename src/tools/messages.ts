import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  PermissionFlagsBits,
  Routes,
  type GuildTextBasedChannel,
  type MessageMentionOptions,
} from "discord.js";
import { z } from "zod";
import { botMember, requirePermissions } from "../discord/guards";
import {
  buildEmbeds,
  emojiKey,
  MAX_BULK_DELETE,
  MAX_CONTENT_LENGTH,
  MAX_EMBED_FIELDS,
  MAX_EMBEDS,
  splitByBulkDeleteAge,
} from "../discord/messages";
import { serializeMessage, serializeUser } from "../discord/serialize";
import { logger } from "../lib/logger";
import { run, UserError } from "../lib/result";
import { colorArg, guildIdArg, reasonArg, snowflake, unloggedReasonArg } from "../lib/schemas";
import { getGuild, getMessage, getMessageChannel, type ToolContext } from "./context";

const channelIdArg = snowflake.describe("The channel ID.");
const messageIdArg = snowflake.describe("The message ID.");
const emojiArg = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe("A Unicode emoji character, or a custom emoji as <:name:id>.");
const contentArg = z
  .string()
  .max(MAX_CONTENT_LENGTH)
  .describe(`Message text, up to ${MAX_CONTENT_LENGTH} characters. Supports Discord markdown.`);
const embedArg = z.object({
  title: z.string().min(1).max(256).optional(),
  description: z.string().min(1).max(4096).optional(),
  url: z.url().optional().describe("Turns the title into a link."),
  color: colorArg.optional(),
  author_name: z.string().min(1).max(256).optional(),
  footer_text: z.string().min(1).max(2048).optional(),
  image_url: z.url().optional(),
  thumbnail_url: z.url().optional(),
  timestamp: z.iso.datetime({ offset: true }).optional().describe("ISO 8601 time shown in the footer."),
  fields: z
    .array(
      z.object({
        name: z.string().min(1).max(256),
        value: z.string().min(1).max(1024),
        inline: z.boolean().optional(),
      }),
    )
    .max(MAX_EMBED_FIELDS)
    .optional(),
});
const embedsArg = z
  .array(embedArg)
  .max(MAX_EMBEDS)
  .describe(`Up to ${MAX_EMBEDS} embeds, with at most 6000 characters of text combined.`);

const CONTENT_HIDDEN_NOTE =
  "MESSAGE_CONTENT is off, so content, embeds and attachments of messages from other users come back empty. Messages that mention the bot are the exception.";

function requireIn(channel: GuildTextBasedChannel, permissions: bigint[]): void {
  const have = botMember(channel.guild).permissionsIn(channel);
  requirePermissions(have, [PermissionFlagsBits.ViewChannel, ...permissions], `#${channel.name}`);
}

function readNote(ctx: ToolContext): { note?: string } {
  return ctx.config.messageContent ? {} : { note: CONTENT_HIDDEN_NOTE };
}

export function registerMessageTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_messages",
    {
      title: "List messages",
      description:
        "Read messages in a channel, newest first. Pass the returned nextBefore as before to get older ones. Use after or around to read from a point instead.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        limit: z.number().int().min(1).max(100).default(50).describe("Messages per page, 1 to 100."),
        before: snowflake.optional().describe("Return messages older than this message ID."),
        after: snowflake.optional().describe("Return messages newer than this message ID."),
        around: snowflake.optional().describe("Return messages around this message ID."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, channel_id, limit, before, after, around }) =>
      run(async () => {
        if ([before, after, around].filter((value) => value !== undefined).length > 1) {
          throw new UserError("Pass only one of before, after and around.");
        }
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory]);
        const messages = await channel.messages.fetch({ limit, before, after, around, cache: false });
        const page = [...messages.values()].map(serializeMessage);
        return {
          messages: page,
          nextBefore: page.length === limit ? page.at(-1)!.id : null,
          ...readNote(ctx),
        };
      }),
  );

  server.registerTool(
    "get_message",
    {
      title: "Get message",
      description: "Get one message by ID, with its embeds, attachments and reactions.",
      inputSchema: { guild_id: guildIdArg, channel_id: channelIdArg, message_id: messageIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, channel_id, message_id }) =>
      run(async () => {
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory]);
        return { message: serializeMessage(await getMessage(channel, message_id)), ...readNote(ctx) };
      }),
  );

  server.registerTool(
    "send_message",
    {
      title: "Send message",
      description:
        "Send a message with text, embeds or both, optionally as a reply. @everyone, @here and role mentions don't ping anyone unless allow_mass_mentions is true.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        content: contentArg.optional(),
        embeds: embedsArg.optional(),
        reply_to: snowflake.optional().describe("ID of a message in the same channel to reply to."),
        allow_mass_mentions: z
          .boolean()
          .default(false)
          .describe("Let @everyone, @here and role mentions ping. User mentions always ping."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, channel_id, content, embeds, reply_to, allow_mass_mentions }) =>
      run(async () => {
        if (!content && !embeds?.length) throw new UserError("Pass content, embeds or both.");
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [
          PermissionFlagsBits.SendMessages,
          ...(embeds?.length ? [PermissionFlagsBits.EmbedLinks] : []),
          ...(reply_to ? [PermissionFlagsBits.ReadMessageHistory] : []),
        ]);
        if (reply_to) await getMessage(channel, reply_to);
        const allowedMentions: MessageMentionOptions = allow_mass_mentions
          ? { parse: ["users", "roles", "everyone"], repliedUser: true }
          : { parse: ["users"], repliedUser: true };
        const message = await channel.send({
          content,
          embeds: embeds && buildEmbeds(embeds),
          allowedMentions,
          reply: reply_to ? { messageReference: reply_to, failIfNotExists: true } : undefined,
        });
        return serializeMessage(message);
      }),
  );

  server.registerTool(
    "edit_message",
    {
      title: "Edit message",
      description:
        "Replace the text or embeds of a message the bot sent. Fields left out stay as they are, an empty embeds list removes all embeds. Discord doesn't let bots edit other users' messages.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        message_id: messageIdArg,
        content: contentArg.optional().describe("New text, an empty string removes it."),
        embeds: embedsArg.optional(),
        reason: unloggedReasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, channel_id, message_id, content, embeds, reason }) =>
      run(async () => {
        if (content === undefined && embeds === undefined)
          throw new UserError("Pass content, embeds or both.");
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [
          PermissionFlagsBits.ReadMessageHistory,
          ...(embeds?.length ? [PermissionFlagsBits.EmbedLinks] : []),
        ]);
        const message = await getMessage(channel, message_id);
        if (message.author.id !== ctx.client.user.id) {
          throw new UserError("The bot can only edit its own messages.");
        }
        const edited = await message.edit({ content, embeds: embeds && buildEmbeds(embeds) });
        logger.info(`edited message ${message_id} in #${channel.name}${reason ? `: ${reason}` : ""}`);
        return serializeMessage(edited);
      }),
  );

  server.registerTool(
    "delete_message",
    {
      title: "Delete message",
      description: "Delete one message. Messages from other users need Manage Messages.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        message_id: messageIdArg,
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, channel_id, message_id, reason }) =>
      run(async () => {
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory]);
        const message = await getMessage(channel, message_id);
        if (message.author.id !== ctx.client.user.id)
          requireIn(channel, [PermissionFlagsBits.ManageMessages]);
        // discord.js Message.delete() has no audit log reason, the REST route does.
        await ctx.client.rest.delete(Routes.channelMessage(channel.id, message.id), { reason });
        return { deleted: serializeMessage(message) };
      }),
  );

  server.registerTool(
    "bulk_delete_messages",
    {
      title: "Bulk delete messages",
      description:
        "Delete up to 100 messages at once, either by ID or the most recent ones, optionally only from one user. Discord can't bulk delete messages older than 14 days: listed IDs that old are refused, recent ones that old are skipped.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        message_ids: z
          .array(snowflake)
          .min(1)
          .max(MAX_BULK_DELETE)
          .optional()
          .describe(`IDs of up to ${MAX_BULK_DELETE} messages to delete.`),
        count: z
          .number()
          .int()
          .min(1)
          .max(MAX_BULK_DELETE)
          .optional()
          .describe(`Delete this many of the most recent messages, 1 to ${MAX_BULK_DELETE}.`),
        user_id: snowflake
          .optional()
          .describe("With count, only delete messages from this user, among the last 100 messages."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, channel_id, message_ids, count, user_id, reason }) =>
      run(async () => {
        if ((message_ids === undefined) === (count === undefined)) {
          throw new UserError("Pass either message_ids or count.");
        }
        if (user_id && count === undefined) throw new UserError("user_id only works together with count.");
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]);

        let ids: string[];
        let skippedOld = 0;
        if (message_ids) {
          ids = [...new Set(message_ids)];
          const { old } = splitByBulkDeleteAge(ids, Date.now());
          if (old.length > 0) {
            throw new UserError(
              `Discord can't bulk delete messages older than 14 days: ${old.join(", ")}. Delete them one by one with delete_message.`,
            );
          }
        } else {
          const fetched = await channel.messages.fetch({
            limit: user_id ? MAX_BULK_DELETE : count,
            cache: false,
          });
          const candidates = [...fetched.values()]
            .filter((message) => !user_id || message.author.id === user_id)
            .slice(0, count)
            .map((message) => message.id);
          const { recent, old } = splitByBulkDeleteAge(candidates, Date.now());
          ids = recent;
          skippedOld = old.length;
        }

        if (ids.length === 1) {
          await ctx.client.rest.delete(Routes.channelMessage(channel.id, ids[0]!), { reason });
        } else if (ids.length > 1) {
          await ctx.client.rest.post(Routes.channelBulkDelete(channel.id), {
            body: { messages: ids },
            reason,
          });
        }
        return { deletedCount: ids.length, deletedIds: ids, skippedOlderThan14Days: skippedOld };
      }),
  );

  server.registerTool(
    "list_pinned_messages",
    {
      title: "List pinned messages",
      description:
        "List a channel's pinned messages, most recently pinned first. Pass the returned nextBefore as before to get older pins.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        limit: z.number().int().min(1).max(50).default(50).describe("Pins per page, 1 to 50."),
        before: z.iso
          .datetime({ offset: true })
          .optional()
          .describe("Return messages pinned before this ISO 8601 time."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, channel_id, limit, before }) =>
      run(async () => {
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory]);
        const { items, hasMore } = await channel.messages.fetchPins({ limit, before, cache: false });
        const pins = items.map((pin) => ({
          pinnedAt: pin.pinnedAt.toISOString(),
          message: serializeMessage(pin.message),
        }));
        return { pins, nextBefore: hasMore ? (pins.at(-1)?.pinnedAt ?? null) : null, ...readNote(ctx) };
      }),
  );

  server.registerTool(
    "pin_message",
    {
      title: "Pin message",
      description: "Pin a message to its channel.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        message_id: messageIdArg,
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, channel_id, message_id, reason }) =>
      run(async () => {
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.PinMessages]);
        const message = await getMessage(channel, message_id);
        if (message.pinned) throw new UserError("That message is already pinned.");
        return serializeMessage(await message.pin(reason));
      }),
  );

  server.registerTool(
    "unpin_message",
    {
      title: "Unpin message",
      description: "Unpin a message. The message itself stays.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        message_id: messageIdArg,
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, channel_id, message_id, reason }) =>
      run(async () => {
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.PinMessages]);
        const message = await getMessage(channel, message_id);
        if (!message.pinned) throw new UserError("That message is not pinned.");
        return serializeMessage(await message.unpin(reason));
      }),
  );

  server.registerTool(
    "add_reaction",
    {
      title: "Add reaction",
      description: "React to a message as the bot.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        message_id: messageIdArg,
        emoji: emojiArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, channel_id, message_id, emoji }) =>
      run(async () => {
        const key = emojiKey(emoji);
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory]);
        const message = await getMessage(channel, message_id);
        // Joining a reaction someone already added doesn't need Add Reactions, starting one does.
        if (!message.reactions.cache.has(key)) requireIn(channel, [PermissionFlagsBits.AddReactions]);
        const reaction = await message.react(emoji);
        return { emoji: reaction.emoji.toString(), count: reaction.count, messageId: message.id };
      }),
  );

  server.registerTool(
    "remove_reaction",
    {
      title: "Remove reaction",
      description:
        "Remove one user's reaction from a message, the bot's own by default. Removing someone else's needs Manage Messages.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        message_id: messageIdArg,
        emoji: emojiArg,
        user_id: snowflake.optional().describe("Whose reaction to remove. Defaults to the bot."),
        reason: unloggedReasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, channel_id, message_id, emoji, user_id, reason }) =>
      run(async () => {
        const key = emojiKey(emoji);
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        const userId = user_id ?? ctx.client.user.id;
        requireIn(channel, [
          PermissionFlagsBits.ReadMessageHistory,
          ...(userId === ctx.client.user.id ? [] : [PermissionFlagsBits.ManageMessages]),
        ]);
        const message = await getMessage(channel, message_id);
        const reaction = message.reactions.cache.get(key);
        if (!reaction) throw new UserError(`The message has no ${emoji} reaction.`);
        await reaction.users.remove(userId);
        logger.info(`removed ${emoji} by ${userId} from message ${message.id}${reason ? `: ${reason}` : ""}`);
        return { removed: { emoji: reaction.emoji.toString(), userId }, messageId: message.id };
      }),
  );

  server.registerTool(
    "clear_reactions",
    {
      title: "Clear reactions",
      description: "Remove every reaction from a message, or only the reactions with one emoji.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        message_id: messageIdArg,
        emoji: emojiArg.optional().describe("Only clear this emoji. Leave out to clear all reactions."),
        reason: unloggedReasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, channel_id, message_id, emoji, reason }) =>
      run(async () => {
        const key = emoji === undefined ? undefined : emojiKey(emoji);
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]);
        const message = await getMessage(channel, message_id);
        if (key === undefined) {
          if (message.reactions.cache.size === 0) throw new UserError("The message has no reactions.");
          await message.reactions.removeAll();
        } else {
          const reaction = message.reactions.cache.get(key);
          if (!reaction) throw new UserError(`The message has no ${emoji} reaction.`);
          await reaction.remove();
        }
        logger.info(
          `cleared ${emoji ?? "all"} reactions on message ${message.id}${reason ? `: ${reason}` : ""}`,
        );
        return { cleared: emoji ?? "all", messageId: message.id };
      }),
  );

  server.registerTool(
    "list_reactions",
    {
      title: "List reactions",
      description:
        "List the users who reacted to a message with one emoji, ordered by user ID. Pass the returned nextAfter as after to get the next page.",
      inputSchema: {
        guild_id: guildIdArg,
        channel_id: channelIdArg,
        message_id: messageIdArg,
        emoji: emojiArg,
        limit: z.number().int().min(1).max(100).default(100).describe("Users per page, 1 to 100."),
        after: snowflake.optional().describe("Return users with an ID greater than this one."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, channel_id, message_id, emoji, limit, after }) =>
      run(async () => {
        const key = emojiKey(emoji);
        const channel = await getMessageChannel(getGuild(ctx, guild_id), channel_id);
        requireIn(channel, [PermissionFlagsBits.ReadMessageHistory]);
        const message = await getMessage(channel, message_id);
        const reaction = message.reactions.cache.get(key);
        if (!reaction) throw new UserError(`The message has no ${emoji} reaction.`);
        const users = [...(await reaction.users.fetch({ limit, after })).values()].map(serializeUser);
        return {
          emoji: reaction.emoji.toString(),
          count: reaction.count,
          users,
          nextAfter: users.length === limit ? users.at(-1)!.id : null,
        };
      }),
  );
}
