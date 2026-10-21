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
      "list_channels",
      "list_roles",
      "list_members",
      "get_member",
    ]);
  });
});
