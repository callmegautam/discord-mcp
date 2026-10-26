import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuditTools } from "./audit";
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

/** Tool groups in registration order, titled for the generated tool reference. */
export const TOOL_GROUPS: ReadonlyArray<{
  title: string;
  register: (server: McpServer, ctx: ToolContext) => void;
}> = [
  { title: "Server", register: registerGuildTools },
  { title: "Channels", register: registerChannelTools },
  { title: "Roles", register: registerRoleTools },
  { title: "Members", register: registerMemberTools },
  { title: "Moderation", register: registerModerationTools },
  { title: "Messages", register: registerMessageTools },
  { title: "Threads and forum posts", register: registerThreadTools },
  { title: "Invites", register: registerInviteTools },
  { title: "Webhooks", register: registerWebhookTools },
  { title: "Emojis and stickers", register: registerEmojiTools },
  { title: "Scheduled events", register: registerEventTools },
  { title: "Audit", register: registerAuditTools },
];

/** Registers every tool, then applies READ_ONLY and DISABLED_TOOLS. Returns the active tool names. */
export function registerTools(server: McpServer, ctx: ToolContext): string[] {
  const { server: tracked, tools } = trackTools(server);
  for (const group of TOOL_GROUPS) group.register(tracked, ctx);
  return applyToolPolicy(tools, ctx.config);
}
