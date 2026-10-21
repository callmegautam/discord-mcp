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
  type GuildMember,
  type NonThreadGuildBasedChannel,
  type Role,
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

export async function getMember(guild: Guild, userId: string): Promise<GuildMember> {
  const member = await guild.members.fetch(userId).catch((error: unknown) => {
    if (isNotFound(error, [RESTJSONErrorCodes.UnknownMember, RESTJSONErrorCodes.UnknownUser])) return null;
    throw error;
  });
  if (!member) throw new UserError(`No member with ID ${userId} in ${guild.name}.`);
  return member;
}
