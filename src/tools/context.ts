import type { Client, Guild } from "discord.js";
import type { Config } from "../config";
import { resolveGuild } from "../discord/resolve";

export interface ToolContext {
  client: Client<true>;
  config: Config;
}

export function getGuild({ client, config }: ToolContext, guildId: string | undefined): Guild {
  return resolveGuild(client.guilds.cache, config.defaultGuildId, guildId);
}
