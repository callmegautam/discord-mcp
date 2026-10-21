import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { serializeMember } from "../discord/serialize";
import { run } from "../lib/result";
import { guildIdArg, snowflake } from "../lib/schemas";
import { getGuild, type ToolContext } from "./context";

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
      inputSchema: { guild_id: guildIdArg, user_id: snowflake.describe("The member's user ID.") },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id, user_id }) =>
      run(async () => serializeMember(await getGuild(ctx, guild_id).members.fetch(user_id))),
  );
}
