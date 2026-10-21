import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PermissionFlagsBits } from "discord.js";
import { z } from "zod";
import { PERMISSION_NAMES } from "../discord/channels";
import {
  botMember,
  compareRoles,
  requirePermissions,
  requireManageableRole,
  requirePermissionsToGrant,
} from "../discord/guards";
import { mergeRolePermissions, moveIndex, parseColor } from "../discord/roles";
import { serializeMember, serializeRole } from "../discord/serialize";
import { run, UserError } from "../lib/result";
import { colorArg, guildIdArg, reasonArg, snowflake } from "../lib/schemas";
import { getGuild, getRole, loadAllMembers, type ToolContext } from "./context";

const roleIdArg = snowflake.describe("The role ID.");
const nameArg = z.string().trim().min(1).max(100).describe("Role name, 1 to 100 characters.");
const hoistArg = z.boolean().describe("Whether members with this role are listed separately in the sidebar.");
const mentionableArg = z.boolean().describe("Whether anyone can @mention this role.");
const permissionList = (what: string) =>
  z.array(z.enum(PERMISSION_NAMES)).default([]).describe(`Permission names to ${what}, e.g. ManageMessages.`);

export function registerRoleTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_roles",
    {
      title: "List roles",
      description:
        "List all roles in a server, highest first, with their permissions. The bot can only manage roles below its own highest role.",
      inputSchema: { guild_id: guildIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id }) =>
      run(async () => {
        const roles = await getGuild(ctx, guild_id).roles.fetch();
        return [...roles.values()].sort((a, b) => b.position - a.position).map(serializeRole);
      }),
  );

  server.registerTool(
    "list_role_members",
    {
      title: "List role members",
      description:
        "List the members who have a role, in pages ordered by user ID. Pass the returned nextAfter as after to get the next page.",
      inputSchema: {
        guild_id: guildIdArg,
        role_id: roleIdArg,
        limit: z.number().int().min(1).max(1000).default(100).describe("Members per page, 1 to 1000."),
        after: snowflake.optional().describe("Return members with a user ID greater than this one."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, role_id, limit, after }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const role = await getRole(guild, role_id);
        if (role.id === guild.id)
          throw new UserError("Every member has @everyone, use list_members instead.");
        await loadAllMembers(guild);
        const page = [...role.members.values()]
          .filter((member) => after === undefined || BigInt(member.id) > BigInt(after))
          .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
          .slice(0, limit)
          .map(serializeMember);
        return {
          roleId: role.id,
          name: role.name,
          members: page,
          nextAfter: page.length === limit ? page.at(-1)!.id : null,
        };
      }),
  );

  server.registerTool(
    "create_role",
    {
      title: "Create role",
      description:
        "Create a role. It starts just above @everyone, use move_role to place it. The bot can only give a role permissions it has itself.",
      inputSchema: {
        guild_id: guildIdArg,
        name: nameArg,
        color: colorArg.optional(),
        hoist: hoistArg.optional(),
        mentionable: mentionableArg.optional(),
        permissions: permissionList("give the role"),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, name, color, hoist, mentionable, permissions, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const me = botMember(guild);
        requirePermissions(me.permissions, [PermissionFlagsBits.ManageRoles]);
        requirePermissionsToGrant(me.permissions, permissions, guild.name);
        const role = await guild.roles.create({
          name,
          colors: color === undefined ? undefined : { primaryColor: parseColor(color) },
          hoist,
          mentionable,
          permissions,
          reason,
        });
        return serializeRole(role);
      }),
  );

  server.registerTool(
    "edit_role",
    {
      title: "Edit role",
      description:
        "Change a role's name, color, sidebar display, mentionability or permissions. Only the fields passed are changed, permissions not listed keep their setting.",
      inputSchema: {
        guild_id: guildIdArg,
        role_id: roleIdArg,
        name: nameArg.optional(),
        color: colorArg.nullable().optional().describe("New hex color like #5865f2, null removes the color."),
        hoist: hoistArg.optional(),
        mentionable: mentionableArg.optional(),
        add_permissions: permissionList("add"),
        remove_permissions: permissionList("remove"),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, role_id, name, color, hoist, mentionable, add_permissions, remove_permissions, reason }) =>
      run(async () => {
        const permissionsChanged = add_permissions.length > 0 || remove_permissions.length > 0;
        if ([name, color, hoist, mentionable].every((value) => value === undefined) && !permissionsChanged) {
          throw new UserError("Pass at least one field to change.");
        }
        const guild = getGuild(ctx, guild_id);
        const role = await getRole(guild, role_id);
        requireManageableRole(guild, role);
        requirePermissionsToGrant(botMember(guild).permissions, add_permissions, guild.name);
        const edited = await role.edit({
          name,
          colors: color === undefined ? undefined : { primaryColor: color === null ? 0 : parseColor(color) },
          hoist,
          mentionable,
          permissions: permissionsChanged
            ? mergeRolePermissions(role.permissions, add_permissions, remove_permissions)
            : undefined,
          reason,
        });
        return serializeRole(edited);
      }),
  );

  server.registerTool(
    "delete_role",
    {
      title: "Delete role",
      description: "Permanently delete a role. Members who had it lose it and its permissions.",
      inputSchema: { guild_id: guildIdArg, role_id: roleIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, role_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const role = await getRole(guild, role_id);
        requireManageableRole(guild, role);
        const deleted = serializeRole(role);
        await role.delete(reason);
        return { deleted };
      }),
  );

  server.registerTool(
    "move_role",
    {
      title: "Move role",
      description:
        "Move a role directly above or below another role in the role list. Pass exactly one of above_role_id or below_role_id. Both roles have to be below the bot's highest role.",
      inputSchema: {
        guild_id: guildIdArg,
        role_id: roleIdArg,
        above_role_id: snowflake.optional().describe("Place the role directly above this role."),
        below_role_id: snowflake.optional().describe("Place the role directly below this role."),
        reason: reasonArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, role_id, above_role_id, below_role_id, reason }) =>
      run(async () => {
        const anchorId = above_role_id ?? below_role_id;
        if (!anchorId || (above_role_id && below_role_id)) {
          throw new UserError("Pass exactly one of above_role_id or below_role_id.");
        }
        const guild = getGuild(ctx, guild_id);
        const role = await getRole(guild, role_id);
        const anchor = await getRole(guild, anchorId);
        requireManageableRole(guild, role);
        const botTop = botMember(guild).roles.highest;
        const place = above_role_id ? "above" : "below";
        if (place === "above" ? compareRoles(botTop, anchor) <= 0 : compareRoles(botTop, anchor) < 0) {
          throw new UserError(
            `Role ${anchor.name} is above where the bot can place roles, its highest role is ${botTop.name}.`,
          );
        }
        const order = [...guild.roles.cache.values()].sort(compareRoles).map((r) => r.id);
        const moved = await role.setPosition(moveIndex(order, role.id, anchor.id, place), { reason });
        return serializeRole(moved);
      }),
  );
}
