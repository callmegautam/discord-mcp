import { z } from "zod";
import { UserError } from "../lib/result";
import { colorArg } from "../lib/schemas";
import {
  CHANNEL_TYPES,
  checkChannelFields,
  PERMISSION_NAMES,
  requireChannelTypeAvailable,
  type PermissionName,
} from "./channels";

export const EVERYONE = "@everyone";
export const MAX_TEMPLATE_ROLES = 50;
export const MAX_TEMPLATE_CHANNELS = 200;

const TEMPLATE_CHANNEL_TYPES = ["text", "voice", "announcement", "stage", "forum"] as const;
export type TemplateChannelType = (typeof TEMPLATE_CHANNEL_TYPES)[number];

const nameField = z.string().trim().min(1).max(100);
const permissionNames = (what: string) =>
  z.array(z.enum(PERMISSION_NAMES)).default([]).describe(`Permission names to ${what}, e.g. ViewChannel.`);

const overwriteSchema = z.object({
  role: nameField.describe(`Name of a role in the template or the server, or "${EVERYONE}".`),
  allow: permissionNames("allow"),
  deny: permissionNames("deny"),
});

const channelSchema = z.object({
  name: nameField.describe(
    "Channel name. Discord lowercases text channel names and turns spaces into dashes.",
  ),
  type: z.enum(TEMPLATE_CHANNEL_TYPES).default("text"),
  topic: z.string().max(4096).optional(),
  nsfw: z.boolean().optional(),
  slowmode_seconds: z.number().int().min(0).max(21600).optional(),
  overwrites: z
    .array(overwriteSchema)
    .default([])
    .describe(
      "Permission overwrites. Without any, a channel in a category takes the category's permissions.",
    ),
});

const categorySchema = z.object({
  name: nameField,
  overwrites: z.array(overwriteSchema).default([]),
  channels: z.array(channelSchema).default([]),
});

const roleSchema = z.object({
  name: nameField,
  color: colorArg.optional(),
  hoist: z.boolean().optional().describe("Show members with this role separately in the sidebar."),
  mentionable: z.boolean().optional(),
  permissions: permissionNames("give the role"),
});

export const templateSchema = z
  .object({
    roles: z
      .array(roleSchema)
      .max(MAX_TEMPLATE_ROLES)
      .default([])
      .describe("Roles, highest first. New roles keep this order, placed just above @everyone."),
    categories: z.array(categorySchema).default([]),
    channels: z.array(channelSchema).default([]).describe("Channels outside any category."),
  })
  .refine(
    (template) =>
      template.categories.length +
        template.channels.length +
        template.categories.reduce((sum, category) => sum + category.channels.length, 0) <=
      MAX_TEMPLATE_CHANNELS,
    { message: `A template can hold up to ${MAX_TEMPLATE_CHANNELS} categories and channels.` },
  );

export type Template = z.infer<typeof templateSchema>;
export type TemplateRole = Template["roles"][number];
export type TemplateChannel = z.infer<typeof channelSchema>;
export type TemplateOverwrite = z.infer<typeof overwriteSchema>;

/** What a server already has, by name. */
export interface ExistingLayout {
  roleNames: readonly string[];
  categories: readonly { id: string; name: string }[];
  /** Channels with the ID of their category, or null outside one. */
  channels: readonly { name: string; parentId: string | null }[];
  features: readonly string[];
}

export type Action = "create" | "skip";

export interface ChannelPlan {
  channel: TemplateChannel;
  action: Action;
}

export interface CategoryPlan {
  name: string;
  overwrites: TemplateOverwrite[];
  action: Action;
  /** Set when the category already exists. */
  existingId: string | null;
  channels: ChannelPlan[];
}

export interface TemplatePlan {
  roles: { role: TemplateRole; action: Action }[];
  categories: CategoryPlan[];
  channels: ChannelPlan[];
}

// Discord stores text channel names lowercased with dashes, so "General Chat" comes back as
// "general-chat" and has to match it.
export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Role names keep their spaces, so they only match case insensitively. */
export function roleKey(name: string): string {
  return name.trim().toLowerCase();
}

function findDuplicates(names: readonly string[], toKey = nameKey): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    const key = toKey(name);
    if (seen.has(key)) duplicates.add(name);
    seen.add(key);
  }
  return [...duplicates];
}

/** Every permission the template allows or denies anywhere, which the bot has to hold itself. */
export function templateGrants(template: Template): PermissionName[] {
  const overwrites = [
    ...template.categories.flatMap((category) => [
      ...category.overwrites,
      ...category.channels.flatMap((channel) => channel.overwrites),
    ]),
    ...template.channels.flatMap((channel) => channel.overwrites),
  ];
  const all = [
    ...template.roles.flatMap((role) => role.permissions),
    ...overwrites.flatMap((overwrite) => [...overwrite.allow, ...overwrite.deny]),
  ];
  return [...new Set(all)];
}

/** Throws one error listing every problem, so nothing is created from a template that can't fully apply. */
export function validateTemplate(template: Template, existing: ExistingLayout): void {
  const problems: string[] = [];
  const knownRoles = new Set(
    [EVERYONE, ...existing.roleNames, ...template.roles.map((role) => role.name)].map(roleKey),
  );

  const duplicateRoles = findDuplicates(
    template.roles.map((role) => role.name),
    roleKey,
  );
  if (duplicateRoles.length > 0) problems.push(`Roles listed more than once: ${duplicateRoles.join(", ")}.`);
  const duplicateCategories = findDuplicates(template.categories.map((category) => category.name));
  if (duplicateCategories.length > 0) {
    problems.push(`Categories listed more than once: ${duplicateCategories.join(", ")}.`);
  }

  const checkOverwrites = (where: string, overwrites: readonly TemplateOverwrite[]) => {
    for (const overwrite of overwrites) {
      if (!knownRoles.has(roleKey(overwrite.role))) {
        problems.push(
          `${where} has an overwrite for ${overwrite.role}, which is neither in the template nor the server.`,
        );
      }
      const both = overwrite.allow.filter((name) => overwrite.deny.includes(name));
      if (both.length > 0)
        problems.push(`${where} both allows and denies ${both.join(", ")} for ${overwrite.role}.`);
    }
    const duplicates = findDuplicates(
      overwrites.map((overwrite) => overwrite.role),
      roleKey,
    );
    if (duplicates.length > 0)
      problems.push(`${where} has more than one overwrite for ${duplicates.join(", ")}.`);
  };

  const checkChannels = (where: string, channels: readonly TemplateChannel[]) => {
    const duplicates = findDuplicates(channels.map((channel) => channel.name));
    if (duplicates.length > 0) problems.push(`${where} lists ${duplicates.join(", ")} more than once.`);
    for (const channel of channels) {
      const type = CHANNEL_TYPES[channel.type];
      try {
        requireChannelTypeAvailable(type, existing.features);
        checkChannelFields(type, {
          topic: channel.topic,
          nsfw: channel.nsfw,
          slowmode_seconds: channel.slowmode_seconds,
        });
      } catch (error) {
        if (!(error instanceof UserError)) throw error;
        problems.push(`#${channel.name}: ${error.message}`);
      }
      checkOverwrites(`#${channel.name}`, channel.overwrites);
    }
  };

  for (const category of template.categories) {
    checkOverwrites(`Category ${category.name}`, category.overwrites);
    checkChannels(`Category ${category.name}`, category.channels);
  }
  checkChannels("The channels outside categories", template.channels);

  if (problems.length > 0) {
    throw new UserError(`The template can't be applied, nothing was changed. ${problems.join(" ")}`);
  }
}

/** Decides what to create and what already exists. Matching is by name, nothing existing is changed. */
export function planTemplate(template: Template, existing: ExistingLayout): TemplatePlan {
  const roleKeys = new Set(existing.roleNames.map(roleKey));
  const channelAction = (channel: TemplateChannel, parentId: string | null): Action =>
    existing.channels.some(
      (other) => other.parentId === parentId && nameKey(other.name) === nameKey(channel.name),
    )
      ? "skip"
      : "create";

  return {
    roles: template.roles.map((role) => ({
      role,
      action: roleKeys.has(roleKey(role.name)) ? "skip" : "create",
    })),
    categories: template.categories.map((category) => {
      const match = existing.categories.find((other) => nameKey(other.name) === nameKey(category.name));
      return {
        name: category.name,
        overwrites: category.overwrites,
        action: match ? "skip" : "create",
        existingId: match?.id ?? null,
        channels: category.channels.map((channel) => ({
          channel,
          action: match ? channelAction(channel, match.id) : "create",
        })),
      };
    }),
    channels: template.channels.map((channel) => ({ channel, action: channelAction(channel, null) })),
  };
}

/** Whether applying the plan writes anything that needs Manage Roles or Manage Channels. */
export function planNeeds(plan: TemplatePlan): { roles: boolean; channels: boolean; overwrites: boolean } {
  const newChannels = [...plan.categories.flatMap((category) => category.channels), ...plan.channels].filter(
    (entry) => entry.action === "create",
  );
  const newCategories = plan.categories.filter((category) => category.action === "create");
  return {
    roles: plan.roles.some((entry) => entry.action === "create"),
    channels: newChannels.length > 0 || newCategories.length > 0,
    overwrites:
      newChannels.some((entry) => entry.channel.overwrites.length > 0) ||
      newCategories.some((category) => category.overwrites.length > 0),
  };
}

/**
 * Overwrites for a new channel: its category's overwrites with the channel's own replacing the same
 * target. Empty means the channel is left to sync with the category.
 */
export function mergeOverwrites<T extends { id: string }>(
  category: readonly T[],
  channel: readonly T[],
): T[] {
  if (channel.length === 0) return [];
  const own = new Set(channel.map((overwrite) => overwrite.id));
  return [...category.filter((overwrite) => !own.has(overwrite.id)), ...channel];
}
