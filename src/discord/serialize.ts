import {
  ChannelType,
  GuildVerificationLevel,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type Role,
} from "discord.js";

export function serializeGuildSummary(guild: Guild) {
  return { id: guild.id, name: guild.name, memberCount: guild.memberCount };
}

export function serializeGuild(guild: Guild) {
  return {
    id: guild.id,
    name: guild.name,
    description: guild.description,
    ownerId: guild.ownerId,
    memberCount: guild.memberCount,
    createdAt: guild.createdAt.toISOString(),
    verificationLevel: GuildVerificationLevel[guild.verificationLevel],
    premiumTier: guild.premiumTier,
    boostCount: guild.premiumSubscriptionCount,
    preferredLocale: guild.preferredLocale,
    iconUrl: guild.iconURL(),
    features: guild.features,
  };
}

export function serializeChannel(channel: GuildBasedChannel) {
  return {
    id: channel.id,
    name: channel.name,
    type: ChannelType[channel.type],
    parentId: channel.parentId,
    position: "position" in channel ? channel.position : null,
    topic: "topic" in channel ? channel.topic : null,
    nsfw: "nsfw" in channel ? channel.nsfw : false,
  };
}

export function serializeRole(role: Role) {
  return {
    id: role.id,
    name: role.name,
    color: role.hexColor,
    position: role.position,
    hoist: role.hoist,
    mentionable: role.mentionable,
    managed: role.managed,
    permissions: role.permissions.toArray(),
  };
}

export function serializeMember(member: GuildMember) {
  return {
    id: member.id,
    username: member.user.username,
    displayName: member.displayName,
    nickname: member.nickname,
    bot: member.user.bot,
    joinedAt: member.joinedAt?.toISOString() ?? null,
    timedOutUntil: member.communicationDisabledUntil?.toISOString() ?? null,
    roles: member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .map((role) => ({ id: role.id, name: role.name })),
  };
}
