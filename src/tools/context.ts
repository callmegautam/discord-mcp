import {
  ChannelType,
  DiscordAPIError,
  DiscordjsError,
  DiscordjsErrorCodes,
  RESTJSONErrorCodes,
  type CategoryChannel,
  type Client,
  type Collection,
  type AnyThreadChannel,
  type Guild,
  type GuildBan,
  type GuildBasedChannel,
  type GuildEmoji,
  type GuildScheduledEvent,
  type GuildMember,
  type GuildTextBasedChannel,
  type Invite,
  type Message,
  type NonThreadGuildBasedChannel,
  type Role,
  type Sticker,
  type User,
  type Webhook,
} from "discord.js";
import type { Config } from "../config";
import { isGuildAllowed, resolveGuild } from "../discord/resolve";
import { UserError } from "../lib/result";

export interface ToolContext {
  client: Client<true>;
  config: Config;
}

export function allowedGuilds({ client, config }: ToolContext): Collection<string, Guild> {
  return client.guilds.cache.filter((guild) => isGuildAllowed(config.allowedGuildIds, guild.id));
}

export function getGuild({ client, config }: ToolContext, guildId: string | undefined): Guild {
  return resolveGuild(client.guilds.cache, config, guildId);
}

function isNotFound(error: unknown, codes: RESTJSONErrorCodes[]): boolean {
  if (error instanceof DiscordAPIError) return codes.includes(Number(error.code));
  return error instanceof DiscordjsError && error.code === DiscordjsErrorCodes.GuildChannelUnowned;
}

/** Any channel in the server, threads included. */
async function fetchChannel(guild: Guild, channelId: string): Promise<GuildBasedChannel> {
  const channel = await guild.channels.fetch(channelId).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownChannel])) return null;
    throw error;
  });
  if (!channel) throw new UserError(`No channel with ID ${channelId} in ${guild.name}.`);
  return channel;
}

export async function getChannel(guild: Guild, channelId: string): Promise<NonThreadGuildBasedChannel> {
  const channel = await fetchChannel(guild, channelId);
  if (channel.isThread()) {
    throw new UserError(`${channel.name} is a thread, use edit_thread or delete_thread for it.`);
  }
  return channel;
}

export async function getThread(guild: Guild, threadId: string): Promise<AnyThreadChannel> {
  const channel = await fetchChannel(guild, threadId);
  if (!channel.isThread()) throw new UserError(`${channel.name} is a channel, not a thread or forum post.`);
  return channel;
}

export async function getCategory(guild: Guild, channelId: string): Promise<CategoryChannel> {
  const channel = await getChannel(guild, channelId);
  if (channel.type !== ChannelType.GuildCategory) throw new UserError(`${channel.name} is not a category.`);
  return channel;
}

/** A permission overwrite target: role IDs are checked first, then members. */
export async function getOverwriteTarget(guild: Guild, id: string): Promise<Role | GuildMember> {
  const role = await guild.roles.fetch(id);
  if (role) return role;
  return getMember(guild, id).catch((error: unknown) => {
    if (error instanceof UserError) throw new UserError(`No role or member with ID ${id} in ${guild.name}.`);
    throw error;
  });
}

export async function getRole(guild: Guild, roleId: string): Promise<Role> {
  const role = await guild.roles.fetch(roleId);
  if (!role) throw new UserError(`No role with ID ${roleId} in ${guild.name}.`);
  return role;
}

export async function findMember(guild: Guild, userId: string): Promise<GuildMember | null> {
  return guild.members.fetch(userId).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownMember, RESTJSONErrorCodes.UnknownUser])) return null;
    throw error;
  });
}

export async function getMember(guild: Guild, userId: string): Promise<GuildMember> {
  const member = await findMember(guild, userId);
  if (!member) throw new UserError(`No member with ID ${userId} in ${guild.name}.`);
  return member;
}

export async function getUser(client: Client, userId: string): Promise<User> {
  const user = await client.users.fetch(userId).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownUser])) return null;
    throw error;
  });
  if (!user) throw new UserError(`No Discord user with ID ${userId}.`);
  return user;
}

/** Needs Ban Members. */
export async function findBan(guild: Guild, userId: string): Promise<GuildBan | null> {
  return guild.bans.fetch({ user: userId, force: true }).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownBan])) return null;
    throw error;
  });
}

/** A channel that holds messages directly: text, announcement, threads, and voice and stage chat. */
export async function getMessageChannel(guild: Guild, channelId: string): Promise<GuildTextBasedChannel> {
  const channel = await fetchChannel(guild, channelId);
  if (!channel.isTextBased()) {
    throw new UserError(`${channel.name} is a ${ChannelType[channel.type]} channel and has no messages.`);
  }
  return channel;
}

export async function getMessage(channel: GuildTextBasedChannel, messageId: string): Promise<Message<true>> {
  const message = await channel.messages
    .fetch({ message: messageId, force: true })
    .catch((error: unknown) => {
      if (isNotFound(error, [RESTJSONErrorCodes.UnknownMessage])) return null;
      throw error;
    });
  if (!message) throw new UserError(`No message with ID ${messageId} in #${channel.name}.`);
  return message;
}

/** Looks up an invite by code and makes sure it belongs to this server. */
export async function getInvite(client: Client, guild: Guild, code: string): Promise<Invite> {
  const invite = await client.fetchInvite(code).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownInvite])) return null;
    throw error;
  });
  if (!invite || invite.guild?.id !== guild.id) throw new UserError(`No invite ${code} in ${guild.name}.`);
  return invite;
}

/** Needs Manage Webhooks in the webhook's channel. */
export async function getWebhook(client: Client, guild: Guild, webhookId: string): Promise<Webhook> {
  const webhook = await client.fetchWebhook(webhookId).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownWebhook])) return null;
    throw error;
  });
  if (!webhook || webhook.guildId !== guild.id) {
    throw new UserError(`No webhook with ID ${webhookId} in ${guild.name}.`);
  }
  return webhook;
}

export async function getEmoji(guild: Guild, emojiId: string): Promise<GuildEmoji> {
  const emoji = await guild.emojis.fetch(emojiId, { force: true }).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownEmoji])) return null;
    throw error;
  });
  if (!emoji) throw new UserError(`No custom emoji with ID ${emojiId} in ${guild.name}.`);
  return emoji;
}

export async function getSticker(guild: Guild, stickerId: string): Promise<Sticker> {
  const sticker = await guild.stickers.fetch(stickerId, { force: true }).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownSticker])) return null;
    throw error;
  });
  if (!sticker) throw new UserError(`No sticker with ID ${stickerId} in ${guild.name}.`);
  return sticker;
}

export async function getScheduledEvent(guild: Guild, eventId: string): Promise<GuildScheduledEvent> {
  const event = await guild.scheduledEvents
    .fetch({ guildScheduledEvent: eventId, force: true, withUserCount: true })
    .catch((error: unknown) => {
      if (isNotFound(error, [RESTJSONErrorCodes.UnknownGuildScheduledEvent])) return null;
      throw error;
    });
  if (!event) throw new UserError(`No scheduled event with ID ${eventId} in ${guild.name}.`);
  return event;
}
