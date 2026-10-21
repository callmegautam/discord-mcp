import type { Client, Collection, Guild } from "discord.js";
import type { Config } from "../config";
import { isGuildAllowed, resolveGuild } from "../discord/resolve";

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
