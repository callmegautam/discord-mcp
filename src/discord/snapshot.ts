import {
  ChannelType,
  GuildExplicitContentFilter,
  GuildMFALevel,
  GuildVerificationLevel,
  OverwriteType,
  type Guild,
  type NonThreadGuildBasedChannel,
} from "discord.js";
import { serializeOverwrite, serializeRole } from "./serialize";

/**
 * Settings, roles and channels with their overwrites in one plain object. Role member counts come
 * from the member cache, so load every member first.
 */
export function snapshotGuild(guild: Guild, channels: readonly NonThreadGuildBasedChannel[]) {
  const me = guild.members.me;
  return {
    guild: {
      id: guild.id,
      name: guild.name,
      ownerId: guild.ownerId,
      memberCount: guild.memberCount,
      verificationLevel: GuildVerificationLevel[guild.verificationLevel],
      explicitContentFilter: GuildExplicitContentFilter[guild.explicitContentFilter],
      mfaLevel: GuildMFALevel[guild.mfaLevel],
      features: guild.features,
    },
    bot: me ? { id: me.id, highestRoleId: me.roles.highest.id, roleIds: [...me.roles.cache.keys()] } : null,
    roles: [...guild.roles.cache.values()]
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        ...serializeRole(role),
        everyone: role.id === guild.id,
        memberCount: role.id === guild.id ? guild.memberCount : role.members.size,
      })),
    channels: [...channels]
      .sort((a, b) => a.position - b.position)
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: ChannelType[channel.type],
        parentId: channel.parentId,
        position: channel.position,
        overwrites: channel.permissionOverwrites.cache.map((overwrite) =>
          serializeOverwrite(
            overwrite,
            overwrite.type === OverwriteType.Role
              ? (guild.roles.cache.get(overwrite.id)?.name ?? null)
              : (guild.members.cache.get(overwrite.id)?.displayName ?? null),
          ),
        ),
      })),
  };
}

export type GuildSnapshot = ReturnType<typeof snapshotGuild>;
