import { ChannelType, PermissionFlagsBits } from "discord.js";
import { UserError } from "../lib/result";

export const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
  announcement: ChannelType.GuildAnnouncement,
  stage: ChannelType.GuildStageVoice,
  forum: ChannelType.GuildForum,
} as const;

export type ChannelTypeName = keyof typeof CHANNEL_TYPES;
export const CHANNEL_TYPE_NAMES = Object.keys(CHANNEL_TYPES) as [ChannelTypeName, ...ChannelTypeName[]];

export type PermissionName = keyof typeof PermissionFlagsBits;
export const PERMISSION_NAMES = Object.keys(PermissionFlagsBits) as [PermissionName, ...PermissionName[]];

const COMMUNITY_ONLY: readonly ChannelType[] = [ChannelType.GuildAnnouncement, ChannelType.GuildStageVoice];

const FIELD_SUPPORT: Record<string, readonly ChannelType[]> = {
  topic: [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
    ChannelType.GuildMedia,
  ],
  slowmode_seconds: [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
    ChannelType.GuildMedia,
  ],
  nsfw: [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
    ChannelType.GuildMedia,
  ],
  parent_id: [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
    ChannelType.GuildMedia,
  ],
};

/** The tool name ("announcement") for types create_channel offers, the discord.js name for the rest. */
export function channelTypeLabel(type: ChannelType): string {
  const name = CHANNEL_TYPE_NAMES.find((key) => CHANNEL_TYPES[key] === type);
  return name ?? ChannelType[type];
}

export function requireChannelTypeAvailable(type: ChannelType, features: readonly string[]): void {
  if (COMMUNITY_ONLY.includes(type) && !features.includes("COMMUNITY")) {
    throw new UserError(
      `${channelTypeLabel(type)} channels need a Community server. Enable it in Server Settings > Enable Community.`,
    );
  }
}

/** Throws when a field is passed that this channel type doesn't have. */
export function checkChannelFields(type: ChannelType, fields: Record<string, unknown>): void {
  for (const [field, types] of Object.entries(FIELD_SUPPORT)) {
    if (fields[field] !== undefined && !types.includes(type)) {
      throw new UserError(`${field} can't be set on a ${channelTypeLabel(type)} channel.`);
    }
  }
}

/** Turns allow, deny and inherit lists into the shape PermissionOverwriteManager.edit expects. */
export function buildOverwrite(
  allow: readonly PermissionName[],
  deny: readonly PermissionName[],
  inherit: readonly PermissionName[],
): Partial<Record<PermissionName, boolean | null>> {
  const overwrite: Partial<Record<PermissionName, boolean | null>> = {};
  const entries: [readonly PermissionName[], boolean | null][] = [
    [allow, true],
    [deny, false],
    [inherit, null],
  ];
  for (const [names, value] of entries) {
    for (const name of names) {
      if (name in overwrite) throw new UserError(`${name} is listed more than once.`);
      overwrite[name] = value;
    }
  }
  if (Object.keys(overwrite).length === 0) {
    throw new UserError("Pass at least one permission in allow, deny or inherit.");
  }
  return overwrite;
}
