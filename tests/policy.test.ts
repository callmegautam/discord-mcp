import { describe, expect, test } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { Client } from "discord.js";
import { loadConfig } from "../src/config";
import { reasonArg } from "../src/lib/schemas";
import { registerTools } from "../src/tools";
import { applyToolPolicy, trackTools } from "../src/tools/policy";

const handler = () => ({ content: [] });
const config = (overrides: { readOnly?: boolean; disabledTools?: string[] } = {}) => ({
  readOnly: false,
  disabledTools: [],
  ...overrides,
});

function setup(defs: Record<string, { annotations?: ToolAnnotations; reason?: boolean }>) {
  const { server, tools } = trackTools(new McpServer({ name: "test", version: "0.0.0" }));
  for (const [name, def] of Object.entries(defs)) {
    server.registerTool(
      name,
      { annotations: def.annotations, inputSchema: def.reason ? { reason: reasonArg } : {} },
      handler,
    );
  }
  return tools;
}

const read = { annotations: { readOnlyHint: true } };
const write = { annotations: { readOnlyHint: false, destructiveHint: false } };
const destroy = { annotations: { readOnlyHint: false, destructiveHint: true }, reason: true };

describe("applyToolPolicy", () => {
  test("keeps every tool by default", () => {
    expect(applyToolPolicy(setup({ list_a: read, edit_a: write, delete_a: destroy }), config())).toEqual([
      "list_a",
      "edit_a",
      "delete_a",
    ]);
  });

  test("removes write tools in read-only mode", () => {
    const tools = setup({ list_a: read, edit_a: write, delete_a: destroy });
    expect(applyToolPolicy(tools, config({ readOnly: true }))).toEqual(["list_a"]);
  });

  test("removes disabled tools", () => {
    const tools = setup({ list_a: read, list_b: read });
    expect(applyToolPolicy(tools, config({ disabledTools: ["list_b"] }))).toEqual(["list_a"]);
  });

  test("rejects an unknown disabled tool and lists the known ones", () => {
    expect(() => applyToolPolicy(setup({ list_a: read }), config({ disabledTools: ["list_b"] }))).toThrow(
      "DISABLED_TOOLS has unknown tools: list_b. Known tools: list_a",
    );
  });

  test("requires readOnlyHint on every tool", () => {
    expect(() => applyToolPolicy(setup({ list_a: {} }), config())).toThrow("list_a must set readOnlyHint");
  });

  test("requires destructiveHint on write tools", () => {
    const tools = setup({ edit_a: { annotations: { readOnlyHint: false } } });
    expect(() => applyToolPolicy(tools, config())).toThrow("edit_a must set destructiveHint");
  });

  test("requires a reason on destructive tools", () => {
    const tools = setup({ delete_a: { ...destroy, reason: false } });
    expect(() => applyToolPolicy(tools, config())).toThrow("delete_a must accept a reason");
  });
});

describe("registerTools", () => {
  const ctx = { client: {} as Client<true>, config: loadConfig({ DISCORD_TOKEN: "test-token" }) };

  test("every shipped tool passes the annotation rules", () => {
    expect(registerTools(new McpServer({ name: "test", version: "0.0.0" }), ctx)).toEqual([
      "list_guilds",
      "get_guild",
      "edit_guild",
      "list_channels",
      "create_channel",
      "edit_channel",
      "delete_channel",
      "clone_channel",
      "list_channel_permissions",
      "set_channel_permission",
      "remove_channel_permission",
      "list_roles",
      "list_role_members",
      "create_role",
      "edit_role",
      "delete_role",
      "move_role",
      "list_members",
      "get_member",
      "search_members",
      "set_nickname",
      "add_member_role",
      "remove_member_role",
      "kick_member",
      "ban_user",
      "unban_user",
      "list_bans",
      "timeout_member",
      "remove_timeout",
      "get_audit_log",
      "list_messages",
      "get_message",
      "send_message",
      "edit_message",
      "delete_message",
      "bulk_delete_messages",
      "list_pinned_messages",
      "pin_message",
      "unpin_message",
      "add_reaction",
      "remove_reaction",
      "clear_reactions",
      "list_reactions",
      "list_threads",
      "create_thread",
      "create_forum_post",
      "edit_thread",
      "delete_thread",
      "list_invites",
      "create_invite",
      "delete_invite",
      "list_webhooks",
      "create_webhook",
      "delete_webhook",
      "list_emojis",
      "create_emoji",
      "delete_emoji",
      "list_stickers",
      "create_sticker",
      "delete_sticker",
      "list_scheduled_events",
      "create_scheduled_event",
      "edit_scheduled_event",
      "delete_scheduled_event",
    ]);
  });

  test("read-only mode keeps only the read tools", () => {
    const readOnly = { ...ctx, config: { ...ctx.config, readOnly: true } };
    expect(registerTools(new McpServer({ name: "test", version: "0.0.0" }), readOnly)).toEqual([
      "list_guilds",
      "get_guild",
      "list_channels",
      "list_channel_permissions",
      "list_roles",
      "list_role_members",
      "list_members",
      "get_member",
      "search_members",
      "list_bans",
      "get_audit_log",
      "list_messages",
      "get_message",
      "list_pinned_messages",
      "list_reactions",
      "list_threads",
      "list_invites",
      "list_webhooks",
      "list_emojis",
      "list_stickers",
      "list_scheduled_events",
    ]);
  });
});
