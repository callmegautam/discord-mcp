import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { auditPermissions } from "../discord/audit";
import { run } from "../lib/result";
import { guildIdArg } from "../lib/schemas";
import { fetchSnapshot, getGuild, type ToolContext } from "./context";

export function registerAuditTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "audit_permissions",
    {
      title: "Audit permissions",
      description:
        "Check a server for risky permission setups: dangerous permissions on @everyone, roles and bots with Administrator, staff or log channels anyone can see, weak verification, content filter and 2FA settings, and powerful roles above the bot. Returns findings with a severity and a suggested fix, most severe first. Changes nothing.",
      inputSchema: { guild_id: guildIdArg },
      annotations: { readOnlyHint: true },
    },
    ({ guild_id }) => run(async () => auditPermissions(await fetchSnapshot(getGuild(ctx, guild_id)))),
  );
}
