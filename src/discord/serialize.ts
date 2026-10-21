import {
  AuditLogEvent,
  ChannelType,
  GuildVerificationLevel,
  type Guild,
  type GuildBasedChannel,
  OverwriteType,
  type GuildAuditLogsEntry,
  type GuildBan,
  type GuildMember,
  type Message,
  MessageType,
  type PermissionOverwrites,
  type Role,
  type User,
} from "discord.js";
import { plainAuditExtra } from "./moderation";

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
    slowmodeSeconds: "rateLimitPerUser" in channel ? channel.rateLimitPerUser : null,
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

export function serializeOverwrite(
  overwrite: Pick<PermissionOverwrites, "id" | "type" | "allow" | "deny">,
  name: string | null,
) {
  return {
    id: overwrite.id,
    type: overwrite.type === OverwriteType.Role ? "role" : "member",
    name,
    allow: overwrite.allow.toArray(),
    deny: overwrite.deny.toArray(),
  };
}

export function serializeUser(user: User) {
  return { id: user.id, username: user.username, bot: user.bot };
}

export function serializeBan(ban: GuildBan) {
  return { user: serializeUser(ban.user), reason: ban.reason ?? null };
}

export function serializeAuditLogEntry(entry: GuildAuditLogsEntry) {
  return {
    id: entry.id,
    action: AuditLogEvent[entry.action],
    createdAt: entry.createdAt.toISOString(),
    executorId: entry.executorId,
    executorName: entry.executor?.username ?? null,
    targetType: entry.targetType,
    targetId: entry.targetId,
    reason: entry.reason,
    changes: entry.changes.map((change) => ({
      key: change.key,
      old: change.old ?? null,
      new: change.new ?? null,
    })),
    extra: plainAuditExtra(entry.extra),
  };
}

export function serializeMessage(message: Message) {
  return {
    id: message.id,
    channelId: message.channelId,
    author: serializeUser(message.author),
    content: message.content,
    type: MessageType[message.type],
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    pinned: message.pinned,
    replyToId: message.reference?.messageId ?? null,
    embeds: message.embeds.map((embed) => ({
      title: embed.title,
      description: embed.description,
      url: embed.url,
      fields: embed.fields.map(({ name, value }) => ({ name, value })),
    })),
    attachments: message.attachments.map((attachment) => ({
      name: attachment.name,
      url: attachment.url,
      size: attachment.size,
      contentType: attachment.contentType,
    })),
    reactions: message.reactions.cache.map((reaction) => ({
      emoji: reaction.emoji.toString(),
      count: reaction.count,
      byBot: reaction.me,
    })),
  };
}
