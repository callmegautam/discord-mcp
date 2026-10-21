import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireManageableRole } from "../discord/guards";
import { serializeMember } from "../discord/serialize";
import { run, UserError } from "../lib/result";
import { guildIdArg, reasonArg, snowflake } from "../lib/schemas";
import { getGuild, getMember, getRole, type ToolContext } from "./context";

const userIdArg = snowflake.describe("The member's user ID.");
const roleIdArg = snowflake.describe("The role ID.");

export function registerMemberTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "list_members",
    {
      title: "List members",
      description:
        "List server members in pages, ordered by user ID. Pass the returned nextAfter as after to get the next page.",
      inputSchema: {
        guild_id: guildIdArg,
        limit: z.number().int().min(1).max(1000).default(100).describe("Members per page, 1 to 1000."),
        after: snowflake.optional().describe("Return members with a user ID greater than this one."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, limit, after }) =>
      run(async () => {
        const members = await getGuild(ctx, guild_id).members.list({ limit, after });
        const page = [...members.values()].map(serializeMember);
        return { members: page, nextAfter: page.length === limit ? page.at(-1)!.id : null };
      }),
  );

  server.registerTool(
    "get_member",
    {
      title: "Get member",
      description: "Get one member of a server by user ID, including their roles and timeout status.",
      inputSchema: { guild_id: guildIdArg, user_id: userIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, user_id }) =>
      run(async () => serializeMember(await getGuild(ctx, guild_id).members.fetch(user_id))),
  );

  server.registerTool(
    "add_member_role",
    {
      title: "Add member role",
      description: "Give a member a role. The role has to be below the bot's highest role.",
      inputSchema: { guild_id: guildIdArg, user_id: userIdArg, role_id: roleIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ guild_id, user_id, role_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const role = await getRole(guild, role_id);
        requireManageableRole(guild, role);
        const member = await getMember(guild, user_id);
        if (member.roles.cache.has(role.id)) {
          throw new UserError(`${member.displayName} already has the ${role.name} role.`);
        }
        return serializeMember(await member.roles.add(role, reason));
      }),
  );

  server.registerTool(
    "remove_member_role",
    {
      title: "Remove member role",
      description: "Take a role away from a member. The role has to be below the bot's highest role.",
      inputSchema: { guild_id: guildIdArg, user_id: userIdArg, role_id: roleIdArg, reason: reasonArg },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ guild_id, user_id, role_id, reason }) =>
      run(async () => {
        const guild = getGuild(ctx, guild_id);
        const role = await getRole(guild, role_id);
        requireManageableRole(guild, role);
        const member = await getMember(guild, user_id);
        if (!member.roles.cache.has(role.id)) {
          throw new UserError(`${member.displayName} doesn't have the ${role.name} role.`);
        }
        return serializeMember(await member.roles.remove(role, reason));
      }),
  );
}
