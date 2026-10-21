import type { Guild, GuildMember, PermissionResolvable, PermissionsBitField } from "discord.js";
import { UserError } from "../lib/result";

interface RankedRole {
  id: string;
  name: string;
  position: number;
}

interface ManagedRole extends RankedRole {
  managed: boolean;
}

interface RankedMember {
  id: string;
  displayName: string;
  highestRole: RankedRole;
}

const ROLE_ORDER_HINT = "Drag the bot's role higher in Server Settings > Roles.";

/** "ManageRoles" to "Manage Roles". */
export function permissionName(flag: string): string {
  return flag.replace(/(?<=[a-z])(?=[A-Z])/g, " ");
}

/** Throws a readable error when the bot lacks any of the permissions. Administrator covers all. */
export function requirePermissions(
  have: Readonly<PermissionsBitField>,
  needed: PermissionResolvable[],
  where?: string,
): void {
  const missing = have.missing(needed);
  if (missing.length === 0) return;
  const names = missing.map(permissionName).join(", ");
  throw new UserError(
    `The bot is missing the ${names} permission${missing.length > 1 ? "s" : ""}${where ? ` in ${where}` : ""}.`,
  );
}

// Same ordering as discord.js Role.comparePositions: higher position wins, and on a tie the
// older role (smaller ID) ranks higher.
export function compareRoles(a: RankedRole, b: RankedRole): number {
  if (a.position !== b.position) return a.position - b.position;
  return Number(BigInt(b.id) - BigInt(a.id));
}

/** Throws unless the bot's highest role can manage this role. */
export function requireRoleBelowBot(guildId: string, botTop: RankedRole, role: ManagedRole): void {
  if (role.id === guildId) throw new UserError("The @everyone role can't be managed like other roles.");
  if (role.managed) {
    throw new UserError(`Role ${role.name} is managed by an integration or bot and can't be changed.`);
  }
  if (compareRoles(botTop, role) <= 0) {
    throw new UserError(
      `Role ${role.name} is at or above the bot's highest role ${botTop.name}. ${ROLE_ORDER_HINT}`,
    );
  }
}

/** Throws unless the bot outranks the member, which kick, ban, timeout and nickname changes need. */
export function requireMemberBelowBot(ownerId: string, bot: RankedMember, target: RankedMember): void {
  if (target.id === ownerId) throw new UserError("The bot can't act on the server owner.");
  if (target.id === bot.id) throw new UserError("The bot can't act on itself.");
  if (compareRoles(bot.highestRole, target.highestRole) <= 0) {
    throw new UserError(
      `${target.displayName}'s highest role ${target.highestRole.name} is at or above the bot's highest role ${bot.highestRole.name}. ${ROLE_ORDER_HINT}`,
    );
  }
}

export function botMember(guild: Guild): GuildMember {
  const me = guild.members.me;
  if (!me) throw new UserError(`The bot's member entry in ${guild.name} is not loaded yet, try again.`);
  return me;
}

export function rankMember(member: GuildMember): RankedMember {
  return { id: member.id, displayName: member.displayName, highestRole: member.roles.highest };
}
