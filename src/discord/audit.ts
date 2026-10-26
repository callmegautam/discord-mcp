import { compareRoles, permissionName } from "./guards";
import type { GuildSnapshot } from "./snapshot";

export type Severity = "high" | "medium" | "low";

export interface Finding {
  severity: Severity;
  check: string;
  target: string;
  detail: string;
  fix: string;
}

/** Permissions that let a holder damage the server or reach everyone in it. */
export const DANGEROUS_PERMISSIONS = [
  "Administrator",
  "ManageGuild",
  "ManageRoles",
  "ManageChannels",
  "BanMembers",
  "KickMembers",
  "ModerateMembers",
  "ManageWebhooks",
  "ManageMessages",
  "ManageNicknames",
  "ManageGuildExpressions",
  "ManageEvents",
  "ManageThreads",
  "MentionEveryone",
] as const;

// In a channel overwrite, ManageRoles means editing that channel's permissions.
const DANGEROUS_IN_CHANNEL = [
  "ManageChannels",
  "ManageRoles",
  "ManageWebhooks",
  "ManageMessages",
  "ManageThreads",
  "MentionEveryone",
] as const;

const PRIVATE_CHANNEL_WORDS = new Set([
  "mod",
  "mods",
  "moderator",
  "moderators",
  "moderation",
  "admin",
  "admins",
  "staff",
  "log",
  "logs",
  "audit",
  "private",
  "internal",
]);

// Many members holding Administrator is how one compromised account takes a server down.
const MANY_ADMINS = 10;
const SOME_ADMINS = 3;

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

type SnapshotRole = GuildSnapshot["roles"][number];
type SnapshotChannel = GuildSnapshot["channels"][number];

function names(permissions: readonly string[]): string {
  return permissions.map(permissionName).join(", ");
}

function dangerous(permissions: readonly string[], list: readonly string[]): string[] {
  return list.filter((permission) => permissions.includes(permission));
}

export function looksPrivate(channelName: string): boolean {
  return channelName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((word) => PRIVATE_CHANNEL_WORDS.has(word));
}

/** Whether @everyone can see the channel, from the server wide permission and the channel's overwrite. */
export function everyoneCanView(everyone: SnapshotRole, channel: SnapshotChannel): boolean {
  if (everyone.permissions.includes("Administrator")) return true;
  const overwrite = channel.overwrites.find((entry) => entry.id === everyone.id);
  if (overwrite?.allow.includes("ViewChannel")) return true;
  if (overwrite?.deny.includes("ViewChannel")) return false;
  return everyone.permissions.includes("ViewChannel");
}

function checkEveryone(everyone: SnapshotRole): Finding[] {
  if (everyone.permissions.includes("Administrator")) {
    return [
      {
        severity: "high",
        check: "everyone_dangerous_permissions",
        target: "@everyone",
        detail: "@everyone has Administrator, so every member can do anything in the server.",
        fix: "Turn Administrator off for @everyone in Server Settings > Roles > @everyone.",
      },
    ];
  }
  const findings: Finding[] = [];
  const risky = dangerous(everyone.permissions, DANGEROUS_PERMISSIONS).filter(
    (permission) => permission !== "MentionEveryone",
  );
  if (risky.length > 0) {
    findings.push({
      severity: "high",
      check: "everyone_dangerous_permissions",
      target: "@everyone",
      detail: `@everyone has ${names(risky)}, so every member can use ${risky.length > 1 ? "them" : "it"}.`,
      fix: `Turn ${names(risky)} off for @everyone in Server Settings > Roles > @everyone, and give ${risky.length > 1 ? "them" : "it"} to a moderator role instead.`,
    });
  }
  // Discord turns this on for @everyone in new servers, so it is common rather than alarming.
  if (everyone.permissions.includes("MentionEveryone")) {
    findings.push({
      severity: "medium",
      check: "everyone_mention",
      target: "@everyone",
      detail: "Every member can ping @everyone, @here and every role, which raiders and spam bots rely on.",
      fix: "Turn Mention @everyone, @here and All Roles off for @everyone in Server Settings > Roles > @everyone.",
    });
  }
  return findings;
}

function checkChannelOverwrites(everyone: SnapshotRole, channels: readonly SnapshotChannel[]): Finding[] {
  const findings: Finding[] = [];
  for (const channel of channels) {
    const overwrite = channel.overwrites.find((entry) => entry.id === everyone.id);
    const risky = overwrite ? dangerous(overwrite.allow, DANGEROUS_IN_CHANNEL) : [];
    if (risky.length === 0) continue;
    findings.push({
      severity: "medium",
      check: "everyone_channel_overwrite",
      target: `#${channel.name} (${channel.id})`,
      detail: `An overwrite in #${channel.name} allows @everyone ${names(risky)}.`,
      fix: `Remove those permissions from the @everyone overwrite with set_channel_permission, putting them back to inherit.`,
    });
  }
  return findings;
}

function checkAdminRoles(roles: readonly SnapshotRole[], botRoleIds: ReadonlySet<string>): Finding[] {
  const findings: Finding[] = [];
  for (const role of roles) {
    if (role.everyone || !role.permissions.includes("Administrator")) continue;
    if (role.managed) {
      const own = botRoleIds.has(role.id);
      findings.push({
        severity: "medium",
        check: "bot_administrator",
        target: `${role.name} (${role.id})`,
        detail: `${own ? "This bot's" : "A bot or integration"} role ${role.name} has Administrator. A leaked bot token would then have full control of the server.`,
        fix: `Re-invite the ${own ? "bot" : "integration"} with only the permissions it needs, or turn Administrator off on its role.`,
      });
      continue;
    }
    const severity: Severity =
      role.memberCount > MANY_ADMINS ? "high" : role.memberCount > SOME_ADMINS ? "medium" : "low";
    findings.push({
      severity,
      check: "administrator_role",
      target: `${role.name} (${role.id})`,
      detail: `${role.name} has Administrator and ${role.memberCount} member${role.memberCount === 1 ? "" : "s"}. Administrator skips every channel overwrite.${role.mentionable ? " The role is also mentionable by everyone." : ""}`,
      fix: "Keep Administrator to as few people as possible. Give moderators the specific permissions they use with edit_role instead.",
    });
  }
  return findings;
}

function checkPrivateChannels(everyone: SnapshotRole, channels: readonly SnapshotChannel[]): Finding[] {
  return channels
    .filter((channel) => looksPrivate(channel.name) && everyoneCanView(everyone, channel))
    .map((channel) => ({
      severity: "medium" as const,
      check: "public_private_channel",
      target: `#${channel.name} (${channel.id})`,
      detail: `#${channel.name} looks like a staff or log channel, but @everyone can see it.`,
      fix: "Deny ViewChannel to @everyone with set_channel_permission and allow it to the staff role, if the channel is meant to be private.",
    }));
}

function checkSettings(guild: GuildSnapshot["guild"]): Finding[] {
  const findings: Finding[] = [];
  if (guild.verificationLevel === "None") {
    findings.push({
      severity: "medium",
      check: "verification_level",
      target: guild.name,
      detail: "The verification level is none, so brand new accounts can post right away.",
      fix: "Raise it to at least low (verified email) with edit_guild.",
    });
  }
  if (guild.explicitContentFilter === "Disabled") {
    findings.push({
      severity: "low",
      check: "explicit_content_filter",
      target: guild.name,
      detail: "The explicit content filter is off, so images from any member go unscanned.",
      fix: "Turn it on in Server Settings > Safety Setup > Content Filter.",
    });
  }
  if (guild.mfaLevel === "None") {
    findings.push({
      severity: "medium",
      check: "moderation_2fa",
      target: guild.name,
      detail:
        "Moderators don't need two-factor authentication, so one stolen password is enough to use their permissions.",
      fix: "The owner can require 2FA for moderation in Server Settings > Safety Setup.",
    });
  }
  return findings;
}

function checkRolesAboveBot(snapshot: GuildSnapshot): Finding[] {
  const botTop = snapshot.roles.find((role) => role.id === snapshot.bot?.highestRoleId);
  if (!botTop) return [];
  return snapshot.roles
    .filter((role) => !role.everyone && !role.managed && compareRoles(role, botTop) > 0)
    .filter((role) => dangerous(role.permissions, DANGEROUS_PERMISSIONS).length > 0)
    .map((role) => ({
      severity: "low" as const,
      check: "role_above_bot",
      target: `${role.name} (${role.id})`,
      detail: `${role.name} has ${names(dangerous(role.permissions, DANGEROUS_PERMISSIONS))} and sits above the bot's highest role, so the bot can't change it.`,
      fix: "Change it by hand in Server Settings > Roles, or drag the bot's role above it first.",
    }));
}

/** Flags risky permission setups in a server snapshot, most severe first. */
export function auditPermissions(snapshot: GuildSnapshot) {
  const everyone = snapshot.roles.find((role) => role.everyone);
  const botRoleIds = new Set(snapshot.bot?.roleIds ?? []);
  const findings = [
    ...(everyone ? checkEveryone(everyone) : []),
    ...(everyone ? checkChannelOverwrites(everyone, snapshot.channels) : []),
    ...checkAdminRoles(snapshot.roles, botRoleIds),
    ...(everyone ? checkPrivateChannels(everyone, snapshot.channels) : []),
    ...checkSettings(snapshot.guild),
    ...checkRolesAboveBot(snapshot),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const count = (severity: Severity) => findings.filter((finding) => finding.severity === severity).length;
  return {
    guild: { id: snapshot.guild.id, name: snapshot.guild.name },
    summary: { high: count("high"), medium: count("medium"), low: count("low") },
    findings,
  };
}
