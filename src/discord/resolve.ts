import { UserError } from "../lib/result";

interface NamedEntity {
  id: string;
  name: string;
}

export interface GuildDefaults {
  defaultGuildId?: string;
  allowedGuildIds: readonly string[];
}

export function isGuildAllowed(allowedGuildIds: readonly string[], guildId: string): boolean {
  return allowedGuildIds.length === 0 || allowedGuildIds.includes(guildId);
}

export function resolveGuild<T extends NamedEntity>(
  guilds: ReadonlyMap<string, T>,
  { defaultGuildId, allowedGuildIds }: GuildDefaults,
  guildId: string | undefined,
): T {
  const id = guildId ?? defaultGuildId;
  if (id) {
    const guild = guilds.get(id);
    if (!guild) throw new UserError(`The bot is not in a server with ID ${id}.`);
    if (!isGuildAllowed(allowedGuildIds, id)) {
      throw new UserError(`Server ${guild.name} (${id}) is not in ALLOWED_GUILD_IDS.`);
    }
    return guild;
  }

  const all = [...guilds.values()].filter((guild) => isGuildAllowed(allowedGuildIds, guild.id));
  if (all.length === 1) return all[0]!;
  if (all.length === 0) {
    throw new UserError(
      guilds.size === 0
        ? "The bot is not in any server yet. Invite it first."
        : "The bot is not in any server listed in ALLOWED_GUILD_IDS.",
    );
  }

  const options = all.map((guild) => `${guild.name} (${guild.id})`).join(", ");
  throw new UserError(`The bot is in several servers, pass guild_id. Options: ${options}`);
}
