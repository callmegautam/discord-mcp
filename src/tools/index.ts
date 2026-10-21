import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerChannelTools } from "./channels";
import type { ToolContext } from "./context";
import { registerEmojiTools } from "./emojis";
import { registerEventTools } from "./events";
import { registerGuildTools } from "./guilds";
import { registerInviteTools } from "./invites";
import { registerMemberTools } from "./members";
import { registerMessageTools } from "./messages";
import { registerModerationTools } from "./moderation";
import { applyToolPolicy, trackTools } from "./policy";
import { registerRoleTools } from "./roles";
import { registerThreadTools } from "./threads";
import { registerWebhookTools } from "./webhooks";

/** Registers every tool, then applies READ_ONLY and DISABLED_TOOLS. Returns the active tool names. */
export function registerTools(server: McpServer, ctx: ToolContext): string[] {
  const { server: tracked, tools } = trackTools(server);
  registerGuildTools(tracked, ctx);
  registerChannelTools(tracked, ctx);
  registerRoleTools(tracked, ctx);
  registerMemberTools(tracked, ctx);
  registerModerationTools(tracked, ctx);
  registerMessageTools(tracked, ctx);
  registerThreadTools(tracked, ctx);
  registerInviteTools(tracked, ctx);
  registerWebhookTools(tracked, ctx);
  registerEmojiTools(tracked, ctx);
  registerEventTools(tracked, ctx);
  return applyToolPolicy(tools, ctx.config);
}
