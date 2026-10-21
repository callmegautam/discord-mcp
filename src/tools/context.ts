import {
  ChannelType,
  DiscordAPIError,
  DiscordjsError,
  DiscordjsErrorCodes,
  RESTJSONErrorCodes,
  type CategoryChannel,
  type Client,
  type Collection,
  type Guild,
  type GuildBan,
  type GuildMember,
  type GuildTextBasedChannel,
  type Message,
  type NonThreadGuildBasedChannel,
  type Role,
  type User,
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

export async function getChannel(guild: Guild, channelId: string): Promise<NonThreadGuildBasedChannel> {
  const channel = await guild.channels.fetch(channelId).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownChannel])) return null;
    throw error;
  });
  if (!channel) throw new UserError(`No channel with ID ${channelId} in ${guild.name}.`);
  if (channel.isThread()) {
    throw new UserError(`${channel.name} is a thread, thread tools are not supported yet.`);
  }
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

/** A channel that holds messages directly: text, announcement, and the chat of voice and stage channels. */
export async function getMessageChannel(guild: Guild, channelId: string): Promise<GuildTextBasedChannel> {
  const channel = await getChannel(guild, channelId);
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
