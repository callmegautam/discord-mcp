import {
  AuditLogEvent,
  ChannelType,
  GuildVerificationLevel,
  StickerFormatType,
  WebhookType,
  type AnyThreadChannel,
  type Guild,
  type GuildBasedChannel,
  OverwriteType,
  type GuildAuditLogsEntry,
  type GuildBan,
  type GuildEmoji,
  type GuildMember,
  type GuildScheduledEvent,
  type Invite,
  type Message,
  MessageType,
  type PermissionOverwrites,
  type Role,
  type Sticker,
  type User,
  type Webhook,
} from "discord.js";
import { eventStatusLabel, eventTypeLabel } from "./events";
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
    systemChannelId: guild.systemChannelId,
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
    forumTags: channel.isThreadOnly()
      ? channel.availableTags.map(({ id, name, moderated }) => ({ id, name, moderated }))
      : null,
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

export function serializeThread(thread: AnyThreadChannel) {
  return {
    id: thread.id,
    name: thread.name,
    type: ChannelType[thread.type],
    parentId: thread.parentId,
    ownerId: thread.ownerId,
    archived: thread.archived,
    locked: thread.locked,
    autoArchiveMinutes: thread.autoArchiveDuration,
    slowmodeSeconds: thread.rateLimitPerUser,
    messageCount: thread.messageCount,
    memberCount: thread.memberCount,
    appliedTagIds: thread.appliedTags,
    createdAt: thread.createdAt?.toISOString() ?? null,
    archivedAt: thread.archived ? (thread.archivedAt?.toISOString() ?? null) : null,
  };
}

export function serializeInvite(invite: Invite) {
  return {
    code: invite.code,
    url: invite.url,
    channelId: invite.channelId,
    inviterId: invite.inviterId,
    uses: invite.uses,
    maxUses: invite.maxUses,
    maxAgeSeconds: invite.maxAge,
    temporary: invite.temporary,
    createdAt: invite.createdAt?.toISOString() ?? null,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
  };
}

// The webhook URL holds its secret token, so it is left out here and only create_webhook returns it.
export function serializeWebhook(webhook: Webhook) {
  return {
    id: webhook.id,
    name: webhook.name,
    type: WebhookType[webhook.type],
    channelId: webhook.channelId,
    creatorId: webhook.owner?.id ?? null,
    applicationId: webhook.applicationId,
    avatarUrl: webhook.avatarURL(),
  };
}

export function serializeEmoji(emoji: GuildEmoji) {
  return {
    id: emoji.id,
    name: emoji.name,
    mention: emoji.toString(),
    animated: emoji.animated,
    managed: emoji.managed,
    available: emoji.available,
    url: emoji.imageURL(),
    roleIds: [...emoji.roles.cache.keys()],
    creatorId: emoji.author?.id ?? null,
  };
}

export function serializeSticker(sticker: Sticker) {
  return {
    id: sticker.id,
    name: sticker.name,
    description: sticker.description,
    tags: sticker.tags,
    format: StickerFormatType[sticker.format],
    available: sticker.available,
    url: sticker.url,
    creatorId: sticker.user?.id ?? null,
  };
}

export function serializeScheduledEvent(event: GuildScheduledEvent) {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    type: eventTypeLabel(event.entityType),
    status: eventStatusLabel(event.status),
    startTime: event.scheduledStartAt?.toISOString() ?? null,
    endTime: event.scheduledEndAt?.toISOString() ?? null,
    channelId: event.channelId,
    location: event.entityMetadata?.location ?? null,
    creatorId: event.creatorId,
    interestedCount: event.userCount,
    url: event.url,
  };
}
