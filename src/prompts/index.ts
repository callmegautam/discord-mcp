import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { ToolContext } from "../tools/context";

const guildIdPromptArg = z.string().optional().describe("Server ID. Leave empty for the default server.");

function userMessage(text: string): GetPromptResult {
  return { messages: [{ role: "user", content: { type: "text", text } }] };
}

function serverPhrase(guildId: string | undefined): string {
  return guildId
    ? `the Discord server ${guildId} (pass guild_id ${guildId} to every tool)`
    : "my Discord server";
}

export function registerPrompts(server: McpServer, ctx: ToolContext): void {
  server.registerPrompt(
    "audit_server_permissions",
    {
      title: "Audit server permissions",
      description: "Review a server's permissions for risky setups and propose fixes without applying them.",
      argsSchema: { guild_id: guildIdPromptArg },
    },
    ({ guild_id }) => {
      const lines = [
        `Audit the permissions of ${serverPhrase(guild_id)}.`,
        "",
        "1. Call audit_permissions. Read the server snapshot resource too if you need more context on a role or channel.",
        "2. Go through the findings from most to least severe. For each, explain in plain words what the risk is and who could abuse it.",
        "3. Point out anything risky the audit doesn't cover that you notice in the snapshot.",
        "4. Propose a fix for each finding: the exact tool call with its arguments (edit_role, set_channel_permission, edit_guild and so on), or the setting to change by hand when no tool covers it.",
        "",
        "Don't change anything yet. Wait until I say which fixes to apply.",
      ];
      if (ctx.config.readOnly)
        lines.push("The server runs in read-only mode, so I will apply the fixes myself.");
      return userMessage(lines.join("\n"));
    },
  );
}
