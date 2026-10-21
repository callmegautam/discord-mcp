import { UserError } from "../lib/result";

interface NamedEntity {
  id: string;
  name: string;
}

export function resolveGuild<T extends NamedEntity>(
  guilds: ReadonlyMap<string, T>,
  defaultGuildId: string | undefined,
  guildId: string | undefined,
): T {
  const id = guildId ?? defaultGuildId;
  if (id) {
    const guild = guilds.get(id);
    if (!guild) throw new UserError(`The bot is not in a server with ID ${id}.`);
    return guild;
  }

  const all = [...guilds.values()];
  if (all.length === 1) return all[0]!;
  if (all.length === 0) throw new UserError("The bot is not in any server yet. Invite it first.");

  const options = all.map((guild) => `${guild.name} (${guild.id})`).join(", ");
  throw new UserError(`The bot is in several servers, pass guild_id. Options: ${options}`);
}
