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

  // The setup prompt ends in apply_template, so it is pointless when that tool is switched off.
  if (ctx.config.readOnly || ctx.config.disabledTools.includes("apply_template")) return;

  server.registerPrompt(
    "setup_community_server",
    {
      title: "Set up a community server",
      description:
        "Design roles, categories and channels for a described community, dry run them as a template and create them after confirmation.",
      argsSchema: {
        description: z
          .string()
          .describe(
            "What the community is about and who it is for, e.g. a study group for a programming course.",
          ),
        guild_id: guildIdPromptArg,
      },
    },
    ({ description, guild_id }) =>
      userMessage(
        [
          `Set up ${serverPhrase(guild_id)} for this community: ${description}`,
          "",
          "1. Call export_template to see what the server already has, and build on it instead of duplicating it.",
          "2. Draft a template for apply_template: roles highest first (at least a staff or moderator role with only the permissions moderators need, no Administrator), categories with their channels, and overwrites that hide staff and log channels from @everyone. Keep it to what this community needs.",
          "3. Call apply_template with dry_run true and show me the plan as a short outline: roles, then each category with its channels, and what gets skipped.",
          "4. Wait for my OK. Then call apply_template with the same template and dry_run false.",
          "5. Call audit_permissions and tell me about anything it flags in what was just created.",
        ].join("\n"),
      ),
  );
}
