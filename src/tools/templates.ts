import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  type Guild,
  type NonThreadGuildBasedChannel,
  type OverwriteData,
  type PermissionOverwriteManager,
} from "discord.js";
import { z } from "zod";
import { CHANNEL_TYPES, channelTypeLabel } from "../discord/channels";
import { botMember, requirePermissions, requirePermissionsToGrant } from "../discord/guards";
import { parseColor } from "../discord/roles";
import {
  EVERYONE,
  mergeOverwrites,
  planNeeds,
  planTemplate,
  roleKey,
  templateGrants,
  templateSchema,
  validateTemplate,
  type Action,
  type ExistingLayout,
  type Template,
  type TemplateChannel,
  type TemplateChannelType,
  type TemplateOverwrite,
  type TemplatePlan,
} from "../discord/templates";
import { run, UserError } from "../lib/result";
import { guildIdArg, reasonArg } from "../lib/schemas";
import { getGuild, type ToolContext } from "./context";

type ResolvedOverwrite = OverwriteData & { id: string };

const EXPORTABLE_TYPES = new Map<ChannelType, TemplateChannelType>([
  [ChannelType.GuildText, "text"],
  [ChannelType.GuildVoice, "voice"],
  [ChannelType.GuildAnnouncement, "announcement"],
  [ChannelType.GuildStageVoice, "stage"],
  [ChannelType.GuildForum, "forum"],
]);

async function fetchChannels(guild: Guild): Promise<NonThreadGuildBasedChannel[]> {
  const channels = await guild.channels.fetch();
  return [...channels.values()]
    .filter((channel): channel is NonThreadGuildBasedChannel => channel !== null)
    .sort((a, b) => a.position - b.position);
}

/** Role overwrites as template entries. Member and bot role overwrites don't carry over to another server. */
function exportOverwrites(guild: Guild, manager: PermissionOverwriteManager, notes: string[], where: string) {
  const overwrites: TemplateOverwrite[] = [];
  for (const overwrite of manager.cache.values()) {
    const role = overwrite.type === OverwriteType.Role ? guild.roles.cache.get(overwrite.id) : null;
    if (!role || role.managed) {
      notes.push(`${where}: left out an overwrite for ${role ? `the bot role ${role.name}` : "a member"}.`);
      continue;
    }
    overwrites.push({
      role: role.id === guild.id ? EVERYONE : role.name,
      allow: overwrite.allow.toArray(),
      deny: overwrite.deny.toArray(),
    });
  }
  return overwrites;
}

function exportChannel(
  guild: Guild,
  channel: NonThreadGuildBasedChannel,
  notes: string[],
): TemplateChannel | null {
  const type = EXPORTABLE_TYPES.get(channel.type);
  if (!type) {
    notes.push(
      `#${channel.name}: ${channelTypeLabel(channel.type)} channels aren't supported in templates, left out.`,
    );
    return null;
  }
  const synced = channel.parent !== null && channel.permissionsLocked === true;
  return {
    name: channel.name,
    type,
    ...("topic" in channel && channel.topic ? { topic: channel.topic } : {}),
    ...("nsfw" in channel && channel.nsfw ? { nsfw: true } : {}),
    ...("rateLimitPerUser" in channel && channel.rateLimitPerUser
      ? { slowmode_seconds: channel.rateLimitPerUser }
      : {}),
    overwrites: synced
      ? []
      : exportOverwrites(guild, channel.permissionOverwrites, notes, `#${channel.name}`),
  };
}

async function exportTemplate(guild: Guild): Promise<{ template: Template; notes: string[] }> {
  const notes: string[] = [];
  const roles = await guild.roles.fetch();
  const channels = await fetchChannels(guild);
  const categories = channels.filter((channel) => channel.type === ChannelType.GuildCategory);
  const inCategory = (parentId: string | null) =>
    channels
      .filter((channel) => channel.type !== ChannelType.GuildCategory && channel.parentId === parentId)
      .map((channel) => exportChannel(guild, channel, notes))
      .filter((channel): channel is TemplateChannel => channel !== null);

  const managed = roles.filter((role) => role.managed);
  if (managed.size > 0)
    notes.push(`Left out bot and integration roles: ${managed.map((role) => role.name).join(", ")}.`);

  const template: Template = {
    roles: [...roles.values()]
      .filter((role) => role.id !== guild.id && !role.managed)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        name: role.name,
        ...(role.color ? { color: role.hexColor } : {}),
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions.toArray(),
      })),
    categories: categories.map((category) => ({
      name: category.name,
      overwrites: exportOverwrites(guild, category.permissionOverwrites, notes, `Category ${category.name}`),
      channels: inCategory(category.id),
    })),
    channels: inCategory(null),
  };
  return { template, notes };
}

function existingLayout(guild: Guild, channels: readonly NonThreadGuildBasedChannel[]): ExistingLayout {
  return {
    roleNames: guild.roles.cache.map((role) => role.name),
    categories: channels
      .filter((channel) => channel.type === ChannelType.GuildCategory)
      .map(({ id, name }) => ({ id, name })),
    channels: channels
      .filter((channel) => channel.type !== ChannelType.GuildCategory)
      .map(({ name, parentId }) => ({ name, parentId })),
    features: guild.features,
  };
}

interface Progress {
  roles: Map<string, string>;
  categories: Map<string, string>;
  channels: Map<string, string>;
}

function describePlan(plan: TemplatePlan, done: Progress | null) {
  const channel = (entry: { channel: TemplateChannel; action: Action }, category: string | null) => ({
    name: entry.channel.name,
    type: entry.channel.type,
    action: entry.action,
    id: done?.channels.get(`${category ?? ""}/${entry.channel.name}`) ?? null,
  });
  const entries = [
    ...plan.roles,
    ...plan.categories,
    ...plan.categories.flatMap((category) => category.channels),
    ...plan.channels,
  ];
  return {
    dryRun: done === null,
    summary: {
      create: entries.filter((entry) => entry.action === "create").length,
      skip: entries.filter((entry) => entry.action === "skip").length,
    },
    roles: plan.roles.map(({ role, action }) => ({
      name: role.name,
      action,
      id: done?.roles.get(roleKey(role.name)) ?? null,
    })),
    categories: plan.categories.map((category) => ({
      name: category.name,
      action: category.action,
      id: category.existingId ?? done?.categories.get(category.name) ?? null,
      channels: category.channels.map((entry) => channel(entry, category.name)),
    })),
    channels: plan.channels.map((entry) => channel(entry, null)),
  };
}

async function applyPlan(guild: Guild, plan: TemplatePlan, reason: string | undefined): Promise<Progress> {
  const done: Progress = { roles: new Map(), categories: new Map(), channels: new Map() };
  const roleIds = new Map(guild.roles.cache.map((role) => [roleKey(role.name), role.id]));
  roleIds.set(roleKey(EVERYONE), guild.id);
  const resolve = (overwrites: readonly TemplateOverwrite[]): ResolvedOverwrite[] =>
    overwrites.map((overwrite) => ({
      id: roleIds.get(roleKey(overwrite.role))!,
      type: OverwriteType.Role,
      allow: overwrite.allow,
      deny: overwrite.deny,
    }));

  let step = "";
  const createChannel = async (
    entry: { channel: TemplateChannel; action: Action },
    parent: { id: string; name: string; overwrites: ResolvedOverwrite[] } | null,
  ) => {
    if (entry.action === "skip") return;
    const { channel } = entry;
    step = `channel #${channel.name}`;
    const overwrites = mergeOverwrites(parent?.overwrites ?? [], resolve(channel.overwrites));
    const created = await guild.channels.create({
      name: channel.name,
      type: CHANNEL_TYPES[channel.type],
      parent: parent?.id,
      topic: channel.topic,
      nsfw: channel.nsfw,
      rateLimitPerUser: channel.slowmode_seconds,
      permissionOverwrites: overwrites.length > 0 ? overwrites : undefined,
      reason,
    });
    done.channels.set(`${parent?.name ?? ""}/${channel.name}`, created.id);
  };

  try {
    // Discord puts each new role just above @everyone and shifts the earlier ones up, so creating
    // them highest first keeps the template order.
    for (const { role, action } of plan.roles) {
      if (action === "skip") continue;
      step = `role ${role.name}`;
      const created = await guild.roles.create({
        name: role.name,
        colors: role.color === undefined ? undefined : { primaryColor: parseColor(role.color) },
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: role.permissions,
        reason,
      });
      roleIds.set(roleKey(role.name), created.id);
      done.roles.set(roleKey(role.name), created.id);
    }

    for (const category of plan.categories) {
      let parent: { id: string; name: string; overwrites: ResolvedOverwrite[] };
      if (category.existingId) {
        const existing = guild.channels.cache.get(category.existingId);
        parent = {
          id: category.existingId,
          name: category.name,
          overwrites:
            existing && "permissionOverwrites" in existing
              ? existing.permissionOverwrites.cache.map((overwrite) => ({
                  id: overwrite.id,
                  type: overwrite.type,
                  allow: overwrite.allow,
                  deny: overwrite.deny,
                }))
              : [],
        };
      } else {
        step = `category ${category.name}`;
        const overwrites = resolve(category.overwrites);
        const created = await guild.channels.create({
          name: category.name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: overwrites,
          reason,
        });
        done.categories.set(category.name, created.id);
        parent = { id: created.id, name: category.name, overwrites };
      }
      for (const entry of category.channels) await createChannel(entry, parent);
    }

    for (const entry of plan.channels) await createChannel(entry, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const created = done.roles.size + done.categories.size + done.channels.size;
    throw new UserError(
      `Stopped while creating ${step}: ${message}. ${created} item${created === 1 ? " was" : "s were"} created before that. Fix the problem and run apply_template again with the same template, everything that already exists is skipped.`,
    );
  }
  return done;
}

export function registerTemplateTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "export_template",
    {
      title: "Export server template",
      description:
        "Turn a server's roles, categories, channels and permission overwrites into a JSON template that apply_template accepts, to save a layout or copy it to another server. Bot roles, member overwrites and unsupported channel types are left out and listed in notes.",
      inputSchema: { guild_id: guildIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id }) => run(() => exportTemplate(getGuild(ctx, guild_id))),
  );

  server.registerTool(
    "apply_template",
    {
      title: "Apply server template",
      description:
        "Create the roles, categories and channels a JSON template describes, with their permissions. It only adds: roles, categories and channels whose name already exists are skipped and nothing is edited or deleted. The whole template is checked before the first change. Run it with dry_run first to see what would be created.",
      inputSchema: {
        guild_id: guildIdArg,
        template: templateSchema.describe(
          "The layout to create. Overwrites refer to roles by name, so a template works on any server.",
        ),
        dry_run: z
          .boolean()
          .default(false)
          .describe("Only report what would be created and skipped, change nothing."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, template, dry_run, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        await guild.roles.fetch();
        const existing = existingLayout(guild, await fetchChannels(guild));
        validateTemplate(template, existing);
        const plan = planTemplate(template, existing);

        const needs = planNeeds(plan);
        const me = botMember(guild);
        const required: bigint[] = [];
        if (needs.roles || needs.overwrites) required.push(PermissionFlagsBits.ManageRoles);
        if (needs.channels) required.push(PermissionFlagsBits.ManageChannels);
        requirePermissions(me.permissions, required);
        requirePermissionsToGrant(me.permissions, templateGrants(template), guild.name);

        if (dry_run) return describePlan(plan, null);
        return describePlan(plan, await applyPlan(guild, plan, reason));
      }),
  );
}
